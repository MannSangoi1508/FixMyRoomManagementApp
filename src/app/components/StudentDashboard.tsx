import { useState, useEffect } from 'react';
import { projectId } from '../../../utils/supabase/info';
import { supabase } from '../supabaseClient';
import {
  Home,
  Calendar,
  Bell,
  LogOut,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Wrench,
  SparklesIcon as Sparkles,
  X,
  FileText,
  CalendarClock,
  BellRing,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';
import BookingForm from './BookingForm';
import ScheduleOverview from './ScheduleOverview';
import CheckupSlotBooking from './CheckupSlotBooking';
import NotificationBell from './NotificationBell';
import { checkAndPerformWeeklyReset } from '../utils/weeklyReset';

interface StudentDashboardProps {
  user: any;
  session: any;
  onSignOut: () => void;
}

function getMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function StudentDashboard({ user, session, onSignOut }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(null);
  const [showCheckupSlots, setShowCheckupSlots] = useState(false);
  const [selectedCheckup, setSelectedCheckup] = useState(null);
  const [checkupPopup, setCheckupPopup] = useState<any>(null);
  const [complaintType, setComplaintType] = useState('complaint');
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);
  const [weeklyBookingCount, setWeeklyBookingCount] = useState<number>(user?.weekly_booking_count ?? 0);
  const [weeklyLimit, setWeeklyLimit] = useState<number>(1);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [complaintComment, setComplaintComment] = useState('');
  const [showCancelCheckupConfirm, setShowCancelCheckupConfirm] = useState(false);
  const [cancelCheckupTarget, setCancelCheckupTarget] = useState<any>(null);
  const [availableCheckupEvents, setAvailableCheckupEvents] = useState<any[]>([]);
  const [showCheckupEventPicker, setShowCheckupEventPicker] = useState(false);

  useEffect(() => {
    if (!user) return;

    checkAndPerformWeeklyReset();
    fetchUpcomingBookings();
    fetchCompletedBookings();
    fetchNotifications();
    fetchAnnouncements();
    fetchComplaints();
    fetchUnreadAnnouncementCount();
    fetchWeeklyBookingCount();

    // Watch regular booking status changes
    const bookingSub = supabase
      .channel('student-bookings-' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUpcomingBookings();
        fetchCompletedBookings();
        fetchWeeklyBookingCount();
      })
      .subscribe();

    // Watch checkup_slots for this student — when completed_at is set, move to completed
    const slotSub = supabase
      .channel('student-slots-' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'checkup_slots',
        filter: `booked_by=eq.${user.id}`
      }, () => {
        fetchUpcomingBookings();
        fetchCompletedBookings();
      })
      .subscribe();

    // Supabase realtime: notifications
    const notificationsChannel = supabase
      .channel('student-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          fetchNotifications();
          // Show popup for checkup notifications
          if (payload.new?.type === 'checkup_scheduled') {
            const match = (payload.new.message || '').match(/checkup ID: ([a-f0-9-]+)/i);
            if (match) {
              setCheckupPopup({ message: payload.new.message, checkupId: match[1] });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingSub);
      supabase.removeChannel(slotSub);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user]);

  const fetchUpcomingBookings = async () => {
    try {
      // Regular bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, service_type, date, time_slot, hostel, floor, status, is_emergency, photos, notes')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('date', { ascending: true });

      // Checkup slots — booked by this student, not cancelled
      // Do NOT filter by completed_at here — fetch all booked slots first
      const { data: slots } = await supabase
        .from('checkup_slots')
        .select(`
          id, time_slot, booked_by, completed_at, is_cancelled,
          routine_checkups ( id, hostel, floor, date, start_time )
        `)
        .eq('booked_by', user.id)
        .eq('is_booked', true)
        .eq('is_cancelled', false);

      // Only show in pending if completed_at is null (not yet done)
      const pendingSlots = (slots ?? [])
        .filter(slot => !slot.completed_at)
        .map(slot => ({
          id: slot.id,
          service_type: 'Routine Checkup',
          date: slot.routine_checkups?.date,
          time_slot: slot.time_slot,
          hostel: slot.routine_checkups?.hostel,
          floor: slot.routine_checkups?.floor,
          status: 'pending',
          is_checkup: true,
          slot_id: slot.id,
          checkup_id: slot.routine_checkups?.id
        }));

      setUpcomingBookings(
        [...(bookings ?? []), ...pendingSlots]
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
    } catch (error) {
      console.error('Error fetching upcoming bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedBookings = async () => {
    try {
      const weekStart = getMonday().toISOString();

      // Regular completed bookings this week
      const { data: completed } = await supabase
        .from('bookings')
        .select('id, service_type, date, time_slot, hostel, floor, status, completed_at, is_emergency')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', weekStart)
        .order('completed_at', { ascending: false });

      // Checkup slots completed this week — completed_at is set AND within this week
      const { data: allSlots } = await supabase
        .from('checkup_slots')
        .select(`
          id, time_slot, booked_by, completed_at, is_cancelled,
          routine_checkups ( hostel, floor, date )
        `)
        .eq('booked_by', user.id)
        .eq('is_booked', true)
        .eq('is_cancelled', false);

      const completedCheckups = (allSlots ?? [])
        .filter(slot => slot.completed_at && new Date(slot.completed_at) >= new Date(weekStart))
        .map(slot => ({
          id: slot.id,
          service_type: 'Routine Checkup',
          date: slot.routine_checkups?.date,
          time_slot: slot.time_slot,
          hostel: slot.routine_checkups?.hostel,
          floor: slot.routine_checkups?.floor,
          status: 'completed',
          completed_at: slot.completed_at,
          is_checkup: true
        }));

      setCompletedBookings(
        [...(completed ?? []), ...completedCheckups]
          .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      );
    } catch (error) {
      console.error('Error fetching completed bookings:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);

      // Check for unread checkup notifications and show popup
      const unreadCheckupNotifs = (data || []).filter(
        (n: any) => n.type === 'checkup_scheduled' && n.read === false
      );

      if (unreadCheckupNotifs.length > 0 && !checkupPopup) {
        const notif = unreadCheckupNotifs[0];
        // Extract checkup info from message
        setCheckupPopup({
          message: notif.message,
          notificationId: notif.id,
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchUnreadAnnouncementCount = async () => {
    const { data } = await supabase
      .from('unread_announcement_counts')
      .select('unread_count')
      .eq('user_id', user.id)
      .single();
    setUnreadAnnouncementCount(data?.unread_count ?? 0);
  };

  const markAnnouncementsRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('type', 'announcement')
      .eq('read', false);
    setUnreadAnnouncementCount(0);
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('target_students', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`*, complaint_comments(*)`)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    }
  };

  const handleSubmitComplaint = async () => {
    if (!complaintSubject.trim() || !complaintDescription.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase.from('complaints').insert({
        student_id: user.id,
        user_name: user.name,
        room_number: user.room_number,
        type: complaintType,
        subject: complaintSubject,
        description: complaintDescription,
        status: 'received'
      });

      if (error) throw error;
      alert('Complaint submitted successfully');
      setComplaintSubject('');
      setComplaintDescription('');
      setComplaintType('complaint');
      fetchComplaints();
    } catch (error: any) {
      alert('Failed to submit complaint: ' + error.message);
    }
  };

  const handleAddComment = async (complaintId: string) => {
    if (!complaintComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    try {
      const { error } = await supabase.from('complaint_comments').insert({
        complaint_id: complaintId,
        user_id: user.id,
        comment: complaintComment
      });

      if (error) throw error;
      setComplaintComment('');
      fetchComplaints();
    } catch (error: any) {
      alert('Failed to add comment: ' + error.message);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const serviceType = showCancelConfirm?.service_type ?? 'housekeeping';
    const isHousekeeping = serviceType === 'housekeeping';
    try {
      const { data, error } = await supabase.rpc('student_cancel_booking', {
        p_booking_id: bookingId,
        p_user_id: user.id
      });

      if (error || !data?.success) {
        alert(data?.error ?? 'Failed to cancel booking');
        return;
      }

      setShowCancelConfirm(null);
      fetchUpcomingBookings();
      fetchCompletedBookings();
      await fetchWeeklyBookingCount();

      if (isHousekeeping) {
        if (data?.credit_returned === true) {
          alert('Booking cancelled. Your credit has been returned.');
        } else if (data?.credit_returned === false) {
          alert('Booking cancelled. No credit was returned (within 3 hours of the slot).');
        } else {
          alert('Booking cancelled.');
        }
      } else {
        alert('Booking cancelled.');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    }
  };


  const handleCancelCheckupConfirmed = async () => {
    if (!cancelCheckupTarget) return;
    try {
      const { data, error } = await supabase.rpc('cancel_checkup_slot', {
        p_slot_id: cancelCheckupTarget.id,
        p_student_id: user.id,
      });
      if (error || !data?.success) {
        alert(data?.error ?? 'Failed to cancel slot');
        return;
      }
      setShowCancelCheckupConfirm(false);
      setCancelCheckupTarget(null);
      await fetchUpcomingBookings();
      fetchWeeklyBookingCount();
    } catch (error) {
      console.error('Error cancelling checkup slot:', error);
      alert('Failed to cancel slot');
    }
  };


  const handleViewCheckupSlots = async (notificationId: string) => {
    try {
      const { data: notif, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (notifError) throw notifError;

      // Prefer the stored checkup_id (present on all new notifications) — unambiguous
      if (notif.checkup_id) {
        const { data: checkup, error: checkupError } = await supabase
          .from('routine_checkups')
          .select('*')
          .eq('id', notif.checkup_id)
          .single();

        if (checkupError) throw checkupError;
        if (checkup) {
          setSelectedCheckup(checkup);
          setShowCheckupSlots(true);
          setCheckupPopup(null);
        }
        return;
      }

      // Fallback for older notifications without checkup_id: parse hostel/floor/date from message
      const dateMatch = notif.message.match(/on (\d{4}-\d{2}-\d{2})/);
      const hostelMatch = notif.message.match(/for (H\d+) Floor (\d+)/);

      if (hostelMatch) {
        const hostel = hostelMatch[1];
        const floor = hostelMatch[2];
        const today = new Date().toISOString().split('T')[0];

        let query = supabase
          .from('routine_checkups')
          .select('*')
          .eq('hostel', hostel)
          .eq('floor', floor)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(1);

        if (dateMatch) {
          query = supabase
            .from('routine_checkups')
            .select('*')
            .eq('hostel', hostel)
            .eq('floor', floor)
            .eq('date', dateMatch[1])
            .order('date', { ascending: true })
            .limit(1);
        }

        const { data: checkups, error: checkupError } = await query;
        if (checkupError) throw checkupError;

        const checkup = checkups?.[0] ?? null;
        if (checkup) {
          setSelectedCheckup(checkup);
          setShowCheckupSlots(true);
          setCheckupPopup(null);
        } else {
          alert('No upcoming checkup found for your hostel and floor.');
        }
      }
    } catch (error) {
      console.error('Error fetching checkup:', error);
      alert('Failed to load checkup slots');
    }
  };

  const handleOpenDirectCheckup = async () => {
    try {
      const { data, error } = await supabase
        .from('student_available_checkup_slots')
        .select('checkup_id')
        .eq('hostel', user.hostel)
        .eq('floor', user.floor);

      if (error) throw error;

      const uniqueIds = [...new Set((data || []).map((s: any) => s.checkup_id).filter(Boolean))];

      if (uniqueIds.length === 0) {
        alert('No checkup currently open for your floor.');
        return;
      }

      // Fetch all event details in parallel
      const results = await Promise.all(
        uniqueIds.map(id =>
          supabase.from('routine_checkups').select('*').eq('id', id).single().then(r => r.data)
        )
      );
      const checkups = results.filter(Boolean).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      if (checkups.length === 1) {
        setSelectedCheckup(checkups[0]);
        setShowCheckupSlots(true);
      } else {
        setAvailableCheckupEvents(checkups);
        setShowCheckupEventPicker(true);
      }
    } catch (err: any) {
      alert('Failed to load checkup: ' + err.message);
    }
  };

  const fetchWeeklyBookingCount = async () => {
    const { data } = await supabase
      .from('student_weekly_housekeeping_status')
      .select('used_this_week, weekly_limit')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setWeeklyBookingCount(data.used_this_week ?? 0);
      setWeeklyLimit(data.weekly_limit ?? 1);
    }
  };

  // Returns true if the slot start time has NOT yet passed (cancellation is still possible)
  const canCancelBooking = (booking: any) => {
    if (booking.status === 'cancelled' || booking.status === 'completed') return false;
    const now = new Date();
    const slotStart = new Date(`${booking.date}T${(booking.time_slot ?? '').split('-')[0]}`);
    if (now >= slotStart) return false;
    // Maintenance and routine checkup: block cancellation within 3 hours of slot start
    const isHousekeeping = booking.service_type === 'housekeeping' && !booking.is_checkup;
    if (!isHousekeeping) {
      const cutoff = new Date(slotStart.getTime() - 3 * 60 * 60 * 1000);
      if (now >= cutoff) return false;
    }
    return true;
  };

  // Returns true if we are within 3 hours of the slot start (cancel allowed but NO credit refund)
  const isWithin3Hours = (booking: any) => {
    const now = new Date();
    const slotStart = new Date(`${booking.date}T${(booking.time_slot ?? '').split('-')[0]}`);
    const cutoff = new Date(slotStart.getTime() - 3 * 60 * 60 * 1000);
    return now >= cutoff && now < slotStart;
  };

  const completedCount = completedBookings.length;
  const pendingCount = upcomingBookings.length;
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-sky-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-gradient-to-br from-sky-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-sky-100 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sky-900">FixMyRoom</h1>
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">Room {user.room_number}</p>
              <p className="text-xs text-gray-500">Hostel {user.hostel} • Floor {user.floor}</p>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-sky-100 px-6 shadow-sm">
        <div className="flex gap-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === id ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors relative ${
              activeTab === 'notifications' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 right-0 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('announcements'); markAnnouncementsRead(); }}
            className={`relative flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'announcements' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
            }`}
          >
            <Mail className="w-4 h-4" />
            Announcements
            {unreadAnnouncementCount > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-medium">
                {unreadAnnouncementCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'complaints' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Complaints
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Weekly Bookings</p>
                    <p className="text-3xl font-bold text-sky-600 mt-1">{weeklyBookingCount}/{weeklyLimit}</p>
                  </div>
                  <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                    <CalendarClock className="w-6 h-6 text-sky-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{completedCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending / In Progress</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{pendingCount}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setShowBookingForm(true)}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-lg hover:from-sky-700 hover:to-sky-800 transition-all shadow-lg shadow-sky-200"
                >
                  <Plus className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">New Booking</p>
                    <p className="text-xs text-sky-100">Request housekeeping or maintenance</p>
                  </div>
                </button>
                <button
                  onClick={handleOpenDirectCheckup}
                  className="flex items-center gap-3 p-4 bg-white border-2 border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50 transition-all"
                >
                  <CalendarClock className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Routine Checkup</p>
                    <p className="text-xs text-purple-400">Book your maintenance checkup slot</p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="flex items-center gap-3 p-4 bg-white border-2 border-sky-200 text-sky-600 rounded-lg hover:bg-sky-50 transition-all"
                >
                  <Calendar className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">View Schedule</p>
                    <p className="text-xs text-sky-400">Check availability and bookings</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Upcoming Bookings */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Bookings</h2>
              {upcomingBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No upcoming bookings</p>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking: any) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4 hover:border-sky-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {booking.service_type === 'housekeeping' ? (
                              <Sparkles className="w-5 h-5 text-sky-600" />
                            ) : booking.service_type === 'routine_checkup' ? (
                              <CalendarClock className="w-5 h-5 text-purple-600" />
                            ) : (
                              <Wrench className="w-5 h-5 text-orange-600" />
                            )}
                            <h3 className="font-medium text-gray-900 capitalize">
                              {booking.service_type === 'routine_checkup' ? 'Routine Checkup' : booking.service_type}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                booking.service_type === 'routine_checkup' ? 'bg-purple-100 text-purple-700' :
                                booking.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {booking.service_type === 'routine_checkup' ? 'Scheduled' :
                               booking.status === 'pending' ? 'Pending' : 'In Progress'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{booking.date} • {booking.time_slot}</p>
                          {booking.notes && <p className="text-sm text-gray-500 mt-1">Note: {booking.notes}</p>}
                        </div>
                        {canCancelBooking(booking) && !booking.is_checkup && (
                          <button
                            onClick={() => setShowCancelConfirm(booking)}
                            className="px-3 py-1.5 border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                          >
                            Cancel Booking
                          </button>
                        )}
                        {booking.is_checkup && canCancelBooking(booking) && (
                          <button
                            onClick={() => { setCancelCheckupTarget(booking); setShowCancelCheckupConfirm(true); }}
                            className="px-3 py-1.5 border-2 border-red-400 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                          >
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed This Week */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Completed This Week ({completedBookings.length})</h2>
              {completedBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No completed bookings this week</p>
              ) : (
                <div className="space-y-3">
                  {completedBookings.map((booking: any) => (
                    <div key={booking.id} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h3 className="font-medium text-gray-900 capitalize">
                          {booking.is_emergency ? 'Emergency' : booking.service_type}
                        </h3>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Completed ✓</span>
                      </div>
                      <p className="text-sm text-gray-600">{booking.date} • {booking.time_slot}</p>
                      <p className="text-sm text-gray-500">{booking.hostel} Floor {booking.floor}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rules */}
            <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-xl p-6 shadow-lg text-white">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Rules & Regulations
              </h2>
              <ul className="space-y-2 text-sm text-sky-100">
                <li>• Housekeeping: 1 booking per week (1 PM – 9 PM)</li>
                <li>• Maintenance: Unlimited bookings (9 AM – 9 PM)</li>
                <li>• Bookings reset every Sunday at 11:59 PM</li>
                <li>• Cancel bookings 3 hours before start time to restore credits</li>
                <li>• Emergency slots available for urgent housekeeping needs</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleOverview session={session} userRole="student" />}

        {activeTab === 'notifications' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BellRing className="w-5 h-5" />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{unreadCount} new</span>
                  )}
                </h2>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllAsRead} className="text-sm text-sky-600 hover:text-sky-700 font-medium">
                    Mark all as read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notifications</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification: any) => {
                    const isCheckupNotification = notification.type === 'checkup_scheduled';
                    const checkupIdMatch = (notification.message || '').match(/checkup ID: ([a-f0-9-]+)/i);
                    const checkupId = checkupIdMatch ? checkupIdMatch[1] : null;

                    return (
                      <div
                        key={notification.id}
                        className={`border rounded-lg p-4 transition-all ${
                          notification.read
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-sky-50 border-sky-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                              {(notification.message || '').replace(/checkup ID: [a-f0-9-]+/i, '').trim()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                              {isCheckupNotification && (
                                <button
                                  onClick={() => {
                                    handleViewCheckupSlots(notification.id);
                                    if (!notification.read) handleMarkAsRead(notification.id);
                                  }}
                                  className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 transition-colors font-medium"
                                >
                                  Book Slot
                                </button>
                              )}
                              {!notification.read && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="px-3 py-1.5 text-xs border border-sky-300 text-sky-600 rounded-lg hover:bg-sky-50 transition-colors"
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="ml-3 mt-1">
                              <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-600" />
                Announcements
              </h2>
              {announcements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs font-medium">
                          Announcement
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(announcement.created_at).toLocaleString()}
                        </span>
                      </div>
                      {announcement.title && <p className="font-medium text-gray-900 mb-1">{announcement.title}</p>}
                      <p className="text-gray-700">{announcement.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'complaints' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Submit New Complaint */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-600" />
                Submit Complaint or Feedback
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={complaintType}
                    onChange={(e) => setComplaintType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="complaint">Complaint</option>
                    <option value="feedback">Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={complaintSubject}
                    onChange={(e) => setComplaintSubject(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Brief subject of your complaint or feedback"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                    rows={4}
                    placeholder="Provide details about your complaint or feedback"
                  />
                </div>
                <button
                  onClick={handleSubmitComplaint}
                  className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium"
                >
                  Submit
                </button>
              </div>
            </div>

            {/* My Complaints */}
            {(() => {
              const isResolved = (c: any) => c.status === 'resolved' || c.status === 'closed';
              const unresolved = complaints.filter((c: any) => !isResolved(c));
              const resolved = complaints.filter((c: any) => isResolved(c));

              const renderComplaint = (complaint: any) => {
                const resolved = isResolved(complaint);
                return (
                  <div key={complaint.id} className={`border rounded-lg p-4 ${resolved ? 'bg-gray-50 border-gray-200 opacity-80' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            (complaint.type === 'Complaint' || complaint.type === 'complaint') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {complaint.type?.charAt(0).toUpperCase() + complaint.type?.slice(1)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            complaint.status === 'received' ? 'bg-orange-100 text-orange-700' :
                            complaint.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {complaint.status?.charAt(0).toUpperCase() + complaint.status?.slice(1)}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900">{complaint.subject}</h3>
                        <p className="text-sm text-gray-600 mt-1">{complaint.description}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Submitted: {new Date(complaint.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Comments */}
                    {complaint.complaint_comments && complaint.complaint_comments.length > 0 && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Comments:</p>
                        <div className="space-y-2">
                          {complaint.complaint_comments.map((comment: any) => (
                            <div key={comment.id} className="bg-gray-50 rounded p-3 text-sm">
                              <p className="text-gray-900">{comment.comment}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add Comment — hidden once resolved */}
                    {!resolved && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={selectedComplaint === complaint.id ? complaintComment : ''}
                            onChange={(e) => {
                              setSelectedComplaint(complaint.id);
                              setComplaintComment(e.target.value);
                            }}
                            placeholder="Add a follow-up comment..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          />
                          <button
                            onClick={() => {
                              handleAddComment(complaint.id);
                              setSelectedComplaint(null);
                            }}
                            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium flex items-center gap-1"
                          >
                            <Send className="w-4 h-4" />
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100 space-y-6">
                  <h2 className="text-lg font-bold text-gray-900">My Complaints & Feedback ({complaints.length})</h2>

                  {complaints.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No complaints or feedback submitted yet</p>
                  ) : (
                    <>
                      {/* Unresolved */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full inline-block" />
                          Open ({unresolved.length})
                        </h3>
                        {unresolved.length === 0 ? (
                          <p className="text-gray-400 text-sm py-4 text-center">No open complaints</p>
                        ) : (
                          <div className="space-y-4">{unresolved.map(renderComplaint)}</div>
                        )}
                      </div>

                      {/* Resolved */}
                      {resolved.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                            Resolved ({resolved.length})
                          </h3>
                          <div className="space-y-4">{resolved.map(renderComplaint)}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      {showBookingForm && (
        <BookingForm
          user={user}
          session={session}
          weeklyBookingCount={weeklyBookingCount}
          onClose={() => {
            setShowBookingForm(false);
            fetchUpcomingBookings();
            fetchCompletedBookings();
            fetchWeeklyBookingCount();
          }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Cancel Booking</h3>
            {showCancelConfirm?.service_type === 'housekeeping' ? (
              isWithin3Hours(showCancelConfirm) ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-5">
                  <p className="text-orange-800 font-medium text-sm mb-1">⚠️ No credit refund</p>
                  <p className="text-orange-700 text-sm">
                    Cancelling now won't restore your credit since it's within 3 hours of your slot. The booking will still be cancelled.
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 mb-5">
                  Are you sure you want to cancel this booking? The slot will become available again and your credit will be restored if cancelled more than 3 hours in advance.
                </p>
              )
            ) : (
              <p className="text-gray-600 mb-5">
                Are you sure you want to cancel this booking? The slot will become available again.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleCancelBooking(showCancelConfirm.id)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Yes, Cancel Booking
              </button>
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                No, Keep It
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Checkup Event Picker — shown when multiple events are open simultaneously */}
      {showCheckupEventPicker && availableCheckupEvents.length > 0 && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCheckupEventPicker(false)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-5 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Routine Checkup Events</h3>
                  <p className="text-purple-100 text-sm mt-0.5">
                    Hostel {user.hostel} • Floor {user.floor} — select an event to book a slot
                  </p>
                </div>
                <button
                  onClick={() => setShowCheckupEventPicker(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {availableCheckupEvents.map((checkup: any) => (
                <div
                  key={checkup.id}
                  className="flex items-center justify-between border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{checkup.date}</p>
                    {checkup.time_window && (
                      <p className="text-sm text-gray-500">{checkup.time_window}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowCheckupEventPicker(false);
                      setSelectedCheckup(checkup);
                      setShowCheckupSlots(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Book Slot
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Checkup Slot Confirm Modal */}
      {showCancelCheckupConfirm && cancelCheckupTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowCancelCheckupConfirm(false); setCancelCheckupTarget(null); }}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-gray-900">Cancel Checkup Slot</h3>
              <button
                onClick={() => { setShowCancelCheckupConfirm(false); setCancelCheckupTarget(null); }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-gray-600 mb-5">
              Cancel your checkup slot on <strong>{cancelCheckupTarget.date}</strong> at <strong>{cancelCheckupTarget.time_slot}</strong>? The slot will become available again. You can rebook via the Routine Checkup card whenever you're ready.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelCheckupConfirmed}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Yes, Cancel Booking
              </button>
              <button
                onClick={() => { setShowCancelCheckupConfirm(false); setCancelCheckupTarget(null); }}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Keep It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkup Slot Booking Modal — shared by all three entry points */}
      {showCheckupSlots && selectedCheckup && (
        <CheckupSlotBooking
          checkupId={selectedCheckup.id}
          checkup={selectedCheckup}
          session={session}
          user={user}
          onClose={() => {
            setShowCheckupSlots(false);
            setSelectedCheckup(null);
            fetchNotifications();
          }}
        />
      )}

      {/* Checkup Popup Banner */}
      {checkupPopup && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white rounded-xl shadow-2xl border border-sky-200 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-gray-900 mb-1">Routine Checkup Scheduled</p>
              <p className="text-sm text-gray-600">
                {checkupPopup.message.replace(/checkup ID: [a-f0-9-]+/i, '').trim()}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleViewCheckupSlots(checkupPopup.notificationId)}
                  className="px-4 py-2 bg-sky-600 text-white text-sm rounded-lg hover:bg-sky-700 transition-colors font-medium"
                >
                  Book Slot
                </button>
                <button
                  onClick={() => setCheckupPopup(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button onClick={() => setCheckupPopup(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
