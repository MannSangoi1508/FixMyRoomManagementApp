import { useState, useEffect } from 'react';
import { projectId } from '../../../utils/supabase/info';
import { supabase } from '../supabaseClient';
import {
  Home,
  Calendar,
  LogOut,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  BarChart3,
  Building2,
  Layers,
  RefreshCw,
  Flag,
  Mail,
  MessageSquare,
  UserCheck,
  History,
  ScrollText,
} from 'lucide-react';
import ScheduleOverview from './ScheduleOverview';
import RoutineCheckups from './RoutineCheckups';
import NotificationBell from './NotificationBell';
import { getMonday } from '../utils/weeklyReset';

interface AdminDashboardProps {
  user: any;
  session: any;
  onSignOut: () => void;
}

export default function AdminDashboard({ user, session, onSignOut }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [targetStudents, setTargetStudents] = useState(false);
  const [targetHousekeeping, setTargetHousekeeping] = useState(false);
  const [targetMaintenance, setTargetMaintenance] = useState(false);
  const [targetRoutineCheckup, setTargetRoutineCheckup] = useState(false);
  const [announcementError, setAnnouncementError] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [roomHistory, setRoomHistory] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [roomNumbers, setRoomNumbers] = useState([]);
  const [historyTaskType, setHistoryTaskType] = useState('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [activityLogType, setActivityLogType] = useState('all');
  const [activityLogStart, setActivityLogStart] = useState('');
  const [activityLogEnd, setActivityLogEnd] = useState('');
  const [monthlyCompletedCancelled, setMonthlyCompletedCancelled] = useState<any[]>([]);
  const [completedBookingsDashboard, setCompletedBookingsDashboard] = useState<any[]>([]);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('all');
  const [completedTypeFilter, setCompletedTypeFilter] = useState('all');
  const [completedFromDate, setCompletedFromDate] = useState('');
  const [completedToDate, setCompletedToDate] = useState('');
  const [cancelledTypeFilter, setCancelledTypeFilter] = useState('all');
  const [cancelledFromDate, setCancelledFromDate] = useState('');
  const [cancelledToDate, setCancelledToDate] = useState('');

  const logAdminAction = async (actionType: string, description: string) => {
    try {
      await supabase.from('admin_activity_log').insert({
        admin_id: user.id,
        action_type: actionType,
        description: description,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const fetchActivityLog = async () => {
    try {
      let query = supabase
        .from('admin_activity_log')
        .select('*')
        .order('performed_at', { ascending: false });

      if (activityLogType !== 'all') {
        query = query.eq('action_type', activityLogType);
      }
      if (activityLogStart) {
        query = query.gte('performed_at', activityLogStart);
      }
      if (activityLogEnd) {
        query = query.lte('performed_at', activityLogEnd + 'T23:59:59.999Z');
      }

      const { data, error } = await query;
      if (error) throw error;
      setActivityLog(data || []);
    } catch (error) {
      console.error('Error fetching activity log:', error);
    }
  };

  useEffect(() => {
    // Reset expired flags on load
    resetExpiredFlags();
    fetchData();
    fetchMonthlyCompletedCancelled();
    fetchCompletedBookingsDashboard();
    fetchAnnouncements();
    fetchComplaints();

    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === 'activity-log') {
      fetchActivityLog();
    }
  }, [activeTab, activityLogType, activityLogStart, activityLogEnd]);

  useEffect(() => {
    if (selectedDate) {
      fetchAttendance();
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedRoom) {
      fetchRoomHistory();
    }
  }, [selectedRoom, historyTaskType, historyStartDate, historyEndDate]);

  const resetExpiredFlags = async () => {
    try {
      await supabase.rpc('reset_expired_flags');
      console.log('Expired flags reset successfully');
    } catch (error) {
      console.error('Error resetting expired flags:', error);
    }
  };

  const fetchMonthlyCompletedCancelled = async () => {
    const { data } = await supabase
      .from('admin_completed_cancelled_this_month')
      .select('*')
      .order('date', { ascending: false });
    setMonthlyCompletedCancelled(data || []);
  };

  const fetchCompletedBookingsDashboard = async () => {
    const { data } = await supabase
      .from('admin_completed_bookings_dashboard')
      .select('*')
      .order('completed_at', { ascending: false });
    setCompletedBookingsDashboard(data || []);
  };

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch users
      const { data: usersData } = await supabase.from('users').select('*');
      setUsers(usersData || []);

      // Room numbers for history dropdown
      const { data: roomData } = await supabase.from('bookings').select('room_number');
      const uniqueRooms = [...new Set((roomData || []).map((b: any) => b.room_number))].sort();
      setRoomNumbers(uniqueRooms);

      // Upcoming bookings (pending/in_progress — used for the Upcoming table)
      const { data: allBookingsData } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: true });
      setBookings(allBookingsData || []);

      // Monthly analytics from view (auto-scoped to current month)
      const { data: monthlyAnalytics } = await supabase
        .from('admin_dashboard_monthly_stats')
        .select('*')
        .single();

      // Active today
      const { count: activeTodayCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .in('status', ['pending', 'in_progress']);

      // Daily completion rate
      const { data: dailyCompletionData } = await supabase.rpc('get_daily_completion_rate', { p_date: today });

      const allBookings = allBookingsData || [];
      const activeStaff = (usersData || []).filter((u: any) => u.role === 'staff').length;
      const totalStudents = (usersData || []).filter((u: any) => u.role === 'student').length;
      const weekStart = getMonday().toISOString();
      const weeklyPending = allBookings.filter((b: any) =>
        (b.status === 'pending' || b.status === 'in_progress') &&
        new Date(b.created_at) >= new Date(weekStart)
      ).length;

      const monthTotal = monthlyAnalytics?.total_bookings ?? 0;
      const monthCompleted = monthlyAnalytics?.completed_bookings ?? 0;
      const monthCancelled = monthlyAnalytics?.cancelled_bookings ?? 0;
      // View provides completion_rate_pct directly; fall back to computing if absent
      const monthRate = monthlyAnalytics?.completion_rate_pct
        ?? (monthTotal > 0 ? parseFloat(((monthCompleted / monthTotal) * 100).toFixed(1)) : 0);

      setAnalytics({
        activeTodayCount: activeTodayCount || 0,
        completedToday: dailyCompletionData?.completed || 0,
        totalToday: dailyCompletionData?.total || 0,
        dailyCompletionRate: dailyCompletionData?.completion_rate || 0,
        totalBookingsThisMonth: monthTotal,
        completedThisMonth: monthCompleted,
        cancelledThisMonth: monthCancelled,
        pendingThisMonth: monthlyAnalytics?.pending_bookings ?? 0,
        inProgressThisMonth: monthlyAnalytics?.in_progress_bookings ?? 0,
        completionRateThisMonth: typeof monthRate === 'number' ? monthRate : parseFloat(monthRate),
        weeklyPendingCount: weeklyPending,
        completedBookings: allBookings.filter((b: any) => b.status === 'completed').length,
        pendingBookings: allBookings.filter((b: any) => b.status === 'pending').length,
        inProgressBookings: allBookings.filter((b: any) => b.status === 'in_progress').length,
        cancelledBookings: allBookings.filter((b: any) => b.status === 'cancelled').length,
        housekeepingBookings: allBookings.filter((b: any) => b.service_type === 'housekeeping').length,
        maintenanceBookings: allBookings.filter((b: any) => b.service_type === 'maintenance').length,
        emergencyBookings: allBookings.filter((b: any) => b.is_emergency === true).length,
        activeStaff,
        totalStudents,
        totalBookings: allBookings.length,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetWeeklyCounts = async () => {
    if (!confirm('Reset weekly booking counts for all students?')) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4438cc7c/admin/reset-weekly-counts`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchData();
      } else {
        alert('Failed to reset weekly counts');
      }
    } catch (error) {
      alert('Failed to reset weekly counts');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking? Student will be notified and credit restored if applicable.')) return;
    try {
      const { data, error } = await supabase.rpc('admin_cancel_booking', {
        p_booking_id: bookingId,
        p_admin_id: user.id,
      });

      if (error) {
        alert('Failed to cancel booking: ' + error.message);
      } else if (data?.success) {
        alert('Booking cancelled successfully');
        fetchData();
      } else {
        alert('Failed to cancel booking');
      }
    } catch (error: any) {
      alert('Failed to cancel booking: ' + error.message);
    }
  };

  const handleNotifyStudent = async (studentId: string) => {
    try {
      const student = (users as any[]).find((u: any) => u.id === studentId);
      // Call RPC that removes the flag and auto-logs to admin_activity_log
      const { error } = await supabase.rpc('remove_student_flag', { p_student_id: studentId });
      if (error) {
        // Fallback to direct update if RPC not available
        const { error: updateError } = await supabase
          .from('users')
          .update({ flagged: false, flag_reason: null })
          .eq('id', studentId);
        if (updateError) throw updateError;
        if (student) await logAdminAction('flag_removed_individual', `Flag removed for ${student.name}, Room ${student.room_number}`);
      }
      alert('Student flag cleared successfully');
      fetchData();
    } catch (error: any) {
      alert('Failed to clear flag: ' + error.message);
    }
  };

  const handleNotifyAllStudents = async () => {
    if (!confirm('Clear flags for all flagged students?')) return;
    try {
      // Call RPC that clears all flags and auto-logs to admin_activity_log
      const { error } = await supabase.rpc('remove_all_flags');
      if (error) {
        // Fallback to direct update if RPC not available
        const { error: updateError } = await supabase
          .from('users')
          .update({ flagged: false, flag_reason: null })
          .eq('role', 'student')
          .eq('flagged', true);
        if (updateError) throw updateError;
        await logAdminAction('flag_removed_all', 'All student flags cleared');
      }
      alert('All student flags cleared successfully');
      fetchData();
    } catch (error: any) {
      alert('Failed to clear all flags: ' + error.message);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const handleSendAnnouncement = async () => {
    setAnnouncementError('');
    if (!announcementText.trim()) {
      setAnnouncementError('Please enter announcement text');
      return;
    }
    if (!targetStudents && !targetHousekeeping && !targetMaintenance && !targetRoutineCheckup) {
      setAnnouncementError('Please select at least one recipient group');
      return;
    }

    try {
      const { error } = await supabase.from('announcements').insert({
        content: announcementText,
        title: announcementTitle.trim() || null,
        target_students: targetStudents,
        target_housekeeping: targetHousekeeping,
        target_maintenance: targetMaintenance,
        target_routine_checkup: targetRoutineCheckup,
        created_by: user.id,
      });

      if (error) throw error;

      // Insert notification rows for targeted staff so unread_announcement_counts reflects this
      const staffTypeFilters: { staff_type: string; targeted: boolean }[] = [
        { staff_type: 'housekeeping', targeted: targetHousekeeping },
        { staff_type: 'maintenance', targeted: targetMaintenance },
        { staff_type: 'routine_checkup', targeted: targetRoutineCheckup },
      ];

      for (const { staff_type, targeted } of staffTypeFilters) {
        if (!targeted) continue;
        const { data: staffMembers } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'staff')
          .eq('staff_type', staff_type);

        if (staffMembers && staffMembers.length > 0) {
          const notifRows = staffMembers.map((s: any) => ({
            user_id: s.id,
            type: 'announcement',
            message: announcementTitle.trim()
              ? `${announcementTitle.trim()}: ${announcementText}`
              : announcementText,
            read: false,
          }));
          await supabase.from('notifications').insert(notifRows);
        }
      }

      const recipients = [
        targetStudents ? 'Students' : '',
        targetHousekeeping ? 'Housekeeping' : '',
        targetMaintenance ? 'Maintenance' : '',
        targetRoutineCheckup ? 'Routine Checkup' : '',
      ].filter(Boolean).join(', ');

      await logAdminAction('announcement_sent', `Announcement sent to: ${recipients} — "${announcementText.slice(0, 50)}"`);
      alert('Announcement sent successfully');
      setAnnouncementText('');
      setAnnouncementTitle('');
      setTargetStudents(false);
      setTargetHousekeeping(false);
      setTargetMaintenance(false);
      setTargetRoutineCheckup(false);
      fetchAnnouncements();
    } catch (error: any) {
      setAnnouncementError('Failed to send announcement: ' + error.message);
    }
  };

  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`*, complaint_comments(*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    }
  };

  const handleUpdateComplaintStatus = async (complaintId: string, newStatus: string, studentId: string) => {
    try {
      const { error } = await supabase
        .from('complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', complaintId);

      if (error) throw error;

      const complaint = (complaints as any[]).find((c: any) => c.id === complaintId);
      // Send notification to student
      await supabase.from('notifications').insert({
        user_id: studentId,
        type: 'complaint_updated',
        message: `Your complaint status has been updated to: ${newStatus}`,
        read: false
      });

      await logAdminAction('complaint_updated', `Complaint ${complaintId} updated to ${newStatus} for ${complaint?.user_name || 'student'}`);
      alert('Complaint status updated');
      fetchComplaints();
    } catch (error: any) {
      alert('Failed to update complaint status: ' + error.message);
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('date', selectedDate);

      if (error) throw error;
      setAttendance(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const handleMarkAttendance = async (staffId: string, status: string) => {
    try {
      // Check if attendance already exists
      const { data: existing } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('staff_id', staffId)
        .eq('date', selectedDate)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('staff_attendance')
          .update({ status, marked_by: user.id })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase.from('staff_attendance').insert({
          staff_id: staffId,
          date: selectedDate,
          status,
          marked_by: user.id
        });

        if (error) throw error;
      }

      const staffMember = (users as any[]).find((u: any) => u.id === staffId);
      if (staffMember) {
        await logAdminAction('attendance_marked', `Attendance marked — ${staffMember.name}: ${status} on ${selectedDate}`);
      }
      fetchAttendance();
    } catch (error: any) {
      alert('Failed to mark attendance: ' + error.message);
    }
  };

  const fetchRoomHistory = async () => {
    if (!selectedRoom) return;

    try {
      // Fetch door-not-opened reports for this room
      const { data: dnrData } = await supabase
        .from('door_not_opened_reports')
        .select('booking_id, reported_at, staff_name')
        .order('reported_at', { ascending: false });
      const dnrMap: Record<string, any> = {};
      (dnrData || []).forEach((r: any) => { dnrMap[r.booking_id] = r; });

      let bookingsQuery = supabase
        .from('bookings')
        .select('id, service_type, date, time_slot, status, completed_at, assigned_staff_name, user_name, is_emergency, cancelled_at, cancelled_by')
        .eq('room_number', selectedRoom);

      if (historyTaskType !== 'all') {
        if (historyTaskType === 'emergency') {
          bookingsQuery = bookingsQuery.eq('is_emergency', true);
        } else {
          bookingsQuery = bookingsQuery.eq('service_type', historyTaskType);
        }
      }

      if (historyStartDate) {
        bookingsQuery = bookingsQuery.gte('date', historyStartDate);
      }

      if (historyEndDate) {
        bookingsQuery = bookingsQuery.lte('date', historyEndDate);
      }

      const { data: bookingsHistory, error: bookingsError } = await bookingsQuery.order('date', { ascending: false });

      if (bookingsError) throw bookingsError;

      // Fetch checkup history
      let checkupQuery = supabase
        .from('checkup_slots')
        .select(`id, time_slot, completed_at, student_name, room_number, routine_checkups(date, hostel, floor)`)
        .eq('room_number', selectedRoom)
        .eq('is_booked', true);

      const { data: checkupHistory, error: checkupError } = await checkupQuery.order('created_at', { ascending: false });

      if (checkupError) throw checkupError;

      // Combine and format
      const allHistory = [
        ...(bookingsHistory || []).map((b: any) => {
          let displayStatus = b.status;
          if (b.status === 'cancelled') {
            displayStatus = b.cancelled_by === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_student';
          } else if (dnrMap[b.id]) {
            displayStatus = 'door_not_opened';
          }
          return {
            ...b,
            task_type: b.is_emergency ? 'Emergency' : b.service_type,
            time: b.time_slot?.split('-')[0] || '',
            display_status: displayStatus,
          };
        }),
        ...(checkupHistory || [])
          .filter((c: any) => {
            if (historyTaskType !== 'all' && historyTaskType !== 'routine_checkup') return false;
            if (historyStartDate && c.routine_checkups?.date < historyStartDate) return false;
            if (historyEndDate && c.routine_checkups?.date > historyEndDate) return false;
            return true;
          })
          .map((c: any) => ({
            id: c.id,
            task_type: 'Routine Checkup',
            date: c.routine_checkups?.date || '',
            time: c.time_slot || '',
            status: c.completed_at ? 'completed' : 'pending',
            completed_at: c.completed_at,
            assigned_staff_name: '',
            user_name: c.student_name,
          }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRoomHistory(allHistory);
    } catch (error) {
      console.error('Error fetching room history:', error);
    }
  };

  if (loading || !analytics) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-sky-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Split bookings into three lists as per requirements
  // Upcoming: ALL pending and in_progress bookings (regardless of date)
  const upcomingBookings = bookings
    .filter((b: any) => b.status === 'pending' || b.status === 'in_progress')
    .sort((a: any, b: any) => {
      // Sort by date first, then by time slot
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      const timeA = a.time_slot?.split('-')[0] || '00:00';
      const timeB = b.time_slot?.split('-')[0] || '00:00';
      return timeA.localeCompare(timeB);
    });

  // Completed — filtered and sorted
  const completedBookings = completedBookingsDashboard
    .filter((b: any) => {
      if (completedTypeFilter === 'emergency') return b.is_emergency;
      if (completedTypeFilter !== 'all') return b.service_type === completedTypeFilter && !b.is_emergency;
      return true;
    })
    .filter((b: any) => {
      if (completedFromDate && b.date < completedFromDate) return false;
      if (completedToDate && b.date > completedToDate) return false;
      return true;
    })
    .sort((a: any, b: any) => new Date(b.completed_at || b.date).getTime() - new Date(a.completed_at || a.date).getTime());

  // Cancelled — filtered and sorted (routine_checkup cancellations shown only in Routine Checkups tab)
  const cancelledBookings = monthlyCompletedCancelled
    .filter((b: any) => b.status === 'cancelled' && b.service_type !== 'routine_checkup')
    .filter((b: any) => {
      if (cancelledTypeFilter === 'emergency') return b.is_emergency;
      if (cancelledTypeFilter !== 'all') return b.service_type === cancelledTypeFilter && !b.is_emergency;
      return true;
    })
    .filter((b: any) => {
      if (cancelledFromDate && b.date < cancelledFromDate) return false;
      if (cancelledToDate && b.date > cancelledToDate) return false;
      return true;
    })
    .sort((a: any, b: any) => new Date(b.cancelled_at ?? b.updated_at).getTime() - new Date(a.cancelled_at ?? a.updated_at).getTime());

  // For stats calculation - active bookings are non-cancelled
  const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled');

  const hostelStats = activeBookings.reduce((acc: any, booking: any) => {
    if (!acc[booking.hostel]) acc[booking.hostel] = 0;
    acc[booking.hostel]++;
    return acc;
  }, {});

  const floorStats = activeBookings.reduce((acc: any, booking: any) => {
    const key = `${booking.hostel}-${booking.floor}`;
    if (!acc[key]) acc[key] = 0;
    acc[key]++;
    return acc;
  }, {});

  // Flagged students: those with flagged = true in the users table
  const flaggedStudents = users.filter((u: any) => u.role === 'student' && u.flagged === true);

  // Use completion rate from server (which excludes cancelled bookings)
  const completionRate = analytics.completionRate || '0.0';

  return (
    <div className="size-full flex flex-col bg-gradient-to-br from-sky-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-sky-100 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sky-900">FixMyRoom — Admin Portal</h1>
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetWeeklyCounts}
              className="flex items-center gap-2 px-4 py-2 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Weekly Counts
            </button>
            <NotificationBell userId={user.id} accentColor="sky" />
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
        <div className="flex gap-6 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'schedule', label: 'Schedule Overview', icon: Calendar },
            { id: 'checkups', label: 'Routine Checkups', icon: Clock },
            { id: 'announcements', label: 'Announcements', icon: Mail },
            { id: 'complaints', label: 'Complaints', icon: MessageSquare },
            { id: 'attendance', label: 'Attendance', icon: UserCheck },
            { id: 'room-history', label: 'Room History', icon: History },
            { id: 'activity-log', label: 'Activity Log', icon: ScrollText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Main Stats - Monthly */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-sky-600 to-sky-700 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sky-100 text-sm">Total Bookings This Month</p>
                    <p className="text-4xl font-bold mt-1">{analytics.totalBookingsThisMonth || 0}</p>
                    <p className="text-xs text-sky-200 mt-1">
                      Excludes cancelled
                    </p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-sky-200" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Completed This Month</p>
                    <p className="text-4xl font-bold text-green-600 mt-1">{analytics.completedThisMonth || 0}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Completion Rate This Month</p>
                    <p className="text-4xl font-bold text-purple-600 mt-1">{analytics.completionRateThisMonth || 0}%</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-purple-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-red-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Cancelled This Month</p>
                    <p className="text-4xl font-bold text-red-600 mt-1">{analytics.cancelledThisMonth || 0}</p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Active Staff</p>
                    <p className="text-3xl font-bold text-sky-600 mt-1">{analytics.activeStaff}</p>
                  </div>
                  <Users className="w-8 h-8 text-sky-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-red-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Flagged Students</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{flaggedStudents.length}</p>
                  </div>
                  <Flag className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Tasks This Week</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{analytics.weeklyPendingCount || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Completion Rate for the Day</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{analytics.dailyCompletionRate || '0.0'}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {analytics.completedToday || 0} completed / {analytics.totalToday || 0} total today
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            {/* Flagged Students */}
            {flaggedStudents.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-md border border-red-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Flag className="w-5 h-5 text-red-600" />
                    Flagged Students ({flaggedStudents.length})
                  </h3>
                  <button
                    onClick={handleNotifyAllStudents}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                  >
                    Notified All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {flaggedStudents.map((student: any) => (
                    <div key={student.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{student.name}</p>
                          <p className="text-sm text-gray-600">
                            Room {student.room_number} • Hostel {student.hostel} • Floor {student.floor}
                          </p>
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                            <Mail className="w-3 h-3" />
                            {student.email}
                          </div>
                          <p className="text-sm text-red-600 mt-1 font-medium">
                            Reason: {student.flag_reason || 'Flagged by system'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleNotifyStudent(student.id)}
                          className="ml-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                        >
                          Notified
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Bookings (all pending/in_progress) */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Bookings ({upcomingBookings.length})</h3>
              <p className="text-sm text-gray-600 mb-4">All pending and in-progress bookings</p>
              {upcomingBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No upcoming bookings</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Service</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Student</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Room / Hostel / Floor</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Photos</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingBookings.map((booking: any) => (
                        <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="capitalize text-gray-800">{booking.service_type}</span>
                              {booking.is_emergency && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Emergency</span>
                              )}
                              {!booking.is_emergency && booking.service_type === 'housekeeping' && (
                                <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 text-xs rounded font-medium">Housekeeping</span>
                              )}
                              {booking.service_type === 'maintenance' && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">Maintenance</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">{booking.user_name}</td>
                          <td className="py-3 px-4">
                            {booking.room_number} • H{booking.hostel} • F{booking.floor}
                          </td>
                          <td className="py-3 px-4">
                            {booking.date} {(booking.time_slot ?? '').split('-').slice(0, 2).join('-')}
                          </td>
                          <td className="py-3 px-4">
                            {booking.photos && booking.photos.length > 0 ? (
                              <div className="flex gap-1">
                                {booking.photos.slice(0, 3).map((url: string, i: number) => (
                                  <img
                                    key={i}
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(url, '_blank')}
                                  />
                                ))}
                                {booking.photos.length > 3 && (
                                  <span className="text-xs text-gray-500">+{booking.photos.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">No photos</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                booking.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {booking.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 transition-colors border border-red-200"
                            >
                              Cancel Booking
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Completed Bookings (all completed) */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-green-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Completed Bookings ({completedBookings.length})</h3>
              <div className="flex flex-wrap gap-3 mb-4">
                <select value={completedTypeFilter} onChange={(e) => setCompletedTypeFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                  <option value="all">All Types</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="emergency">Emergency</option>
                </select>
                <input type="date" value={completedFromDate} onChange={(e) => setCompletedFromDate(e.target.value)}
                  placeholder="From date"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                <input type="date" value={completedToDate} onChange={(e) => setCompletedToDate(e.target.value)}
                  placeholder="To date"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                {(completedTypeFilter !== 'all' || completedFromDate || completedToDate) && (
                  <button onClick={() => { setCompletedTypeFilter('all'); setCompletedFromDate(''); setCompletedToDate(''); }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 underline">Clear</button>
                )}
              </div>
              {completedBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No completed bookings</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Service</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Student</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Room</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Hostel / Floor</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time Slot</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Photos</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Completed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedBookings.map((booking: any) => (
                        <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="capitalize text-gray-800">{booking.service_type}</span>
                              {booking.is_emergency && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Emergency</span>
                              )}
                              {!booking.is_emergency && booking.service_type === 'housekeeping' && (
                                <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 text-xs rounded font-medium">Housekeeping</span>
                              )}
                              {booking.service_type === 'maintenance' && (
                                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded font-medium">Maintenance</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">{booking.user_name}</td>
                          <td className="py-3 px-4">{booking.room_number}</td>
                          <td className="py-3 px-4">
                            {booking.hostel} • Floor {booking.floor}
                          </td>
                          <td className="py-3 px-4">
                            {booking.date} • {booking.time_slot}
                          </td>
                          <td className="py-3 px-4">
                            {booking.photos && booking.photos.length > 0 ? (
                              <div className="flex gap-1">
                                {booking.photos.slice(0, 3).map((url: string, i: number) => (
                                  <img
                                    key={i}
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    className="w-10 h-10 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(url, '_blank')}
                                  />
                                ))}
                                {booking.photos.length > 3 && (
                                  <span className="text-xs text-gray-500 ml-1">+{booking.photos.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">No photos</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {booking.completed_at ? new Date(booking.completed_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cancelled Bookings Section */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>Cancelled Bookings ({cancelledBookings.length})</span>
                <span className="text-xs font-normal text-gray-500">- Not included in active counts</span>
              </h3>
              <div className="flex flex-wrap gap-3 mb-4">
                <select value={cancelledTypeFilter} onChange={(e) => setCancelledTypeFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                  <option value="all">All Types</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="routine_checkup">Routine Checkup</option>
                  <option value="emergency">Emergency</option>
                </select>
                <input type="date" value={cancelledFromDate} onChange={(e) => setCancelledFromDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                <input type="date" value={cancelledToDate} onChange={(e) => setCancelledToDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
                {(cancelledTypeFilter !== 'all' || cancelledFromDate || cancelledToDate) && (
                  <button onClick={() => { setCancelledTypeFilter('all'); setCancelledFromDate(''); setCancelledToDate(''); }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 underline">Clear</button>
                )}
              </div>
              {cancelledBookings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No cancelled bookings</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Service</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Student</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Room / Hostel / Floor</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Cancelled At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledBookings.map((booking: any) => (
                        <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50 opacity-70">
                          <td className="py-3 px-4 capitalize">{booking.service_type}</td>
                          <td className="py-3 px-4">{booking.user_name}</td>
                          <td className="py-3 px-4">
                            {booking.room_number} • H{booking.hostel} • F{booking.floor}
                          </td>
                          <td className="py-3 px-4">
                            {booking.date} {(booking.time_slot ?? '').split('-').slice(0, 2).join('-')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-gray-500">
                              {new Date(booking.cancelled_at ?? booking.updated_at).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Detailed Analytics</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Service Distribution</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Housekeeping', value: analytics.housekeepingBookings, color: 'bg-sky-600' },
                    { label: 'Maintenance', value: analytics.maintenanceBookings, color: 'bg-orange-600' },
                    { label: 'Emergency', value: analytics.emergencyBookings, color: 'bg-red-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        <span className="text-sm font-bold">{value}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${color} h-2 rounded-full`}
                          style={{ width: analytics.totalBookings > 0 ? `${(value / analytics.totalBookings) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Status Overview</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Completed', value: analytics.completedBookings, cls: 'bg-green-50 border-green-200 text-green-600' },
                    { label: 'In Progress', value: analytics.inProgressBookings, cls: 'bg-blue-50 border-blue-200 text-blue-600' },
                    { label: 'Pending', value: analytics.pendingBookings, cls: 'bg-orange-50 border-orange-200 text-orange-600' },
                    { label: 'Cancelled', value: analytics.cancelledBookings, cls: 'bg-gray-50 border-gray-200 text-gray-600' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`flex items-center justify-between p-3 rounded-lg border ${cls}`}>
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className="text-lg font-bold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-sky-600" />
                Hostel-wise Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(hostelStats).map(([hostel, count]: [string, any]) => (
                  <div key={hostel} className="border border-gray-200 rounded-lg p-4">
                    <p className="text-2xl font-bold text-sky-600">{count}</p>
                    <p className="text-sm text-gray-600">Hostel {hostel}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-600" />
                Floor-wise Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Object.entries(floorStats).map(([key, count]: [string, any]) => {
                  const [hostel, floor] = key.split('-');
                  return (
                    <div key={key} className="border border-gray-200 rounded-lg p-4">
                      <p className="text-2xl font-bold text-sky-600">{count}</p>
                      <p className="text-sm text-gray-600">H{hostel} • Floor {floor}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600" />
                User Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-3xl font-bold text-sky-600">{analytics.totalStudents}</p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-3xl font-bold text-sky-600">{analytics.activeStaff}</p>
                  <p className="text-sm text-gray-600">Active Staff</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-3xl font-bold text-red-500">{flaggedStudents.length}</p>
                  <p className="text-sm text-gray-600">Flagged Students</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleOverview session={session} userRole="admin" />}
        {activeTab === 'checkups' && <RoutineCheckups session={session} user={user} logAdminAction={logAdminAction} />}

        {activeTab === 'announcements' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Compose Announcement */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-sky-600" />
                Compose Announcement
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title (optional)</label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Announcement title..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Announcement Text</label>
                  <textarea
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                    rows={4}
                    placeholder="Enter your announcement here..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Send To</label>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { key: 'students', label: 'Students', value: targetStudents, setter: setTargetStudents },
                      { key: 'housekeeping', label: 'Housekeeping Staff', value: targetHousekeeping, setter: setTargetHousekeeping },
                      { key: 'maintenance', label: 'Maintenance Staff', value: targetMaintenance, setter: setTargetMaintenance },
                      { key: 'routine_checkup', label: 'Routine Checkup Staff', value: targetRoutineCheckup, setter: setTargetRoutineCheckup },
                    ].map(({ key, label, value, setter }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setter(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {announcementError && (
                  <p className="text-sm text-red-600">{announcementError}</p>
                )}
                <button
                  onClick={handleSendAnnouncement}
                  className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium"
                >
                  Send Announcement
                </button>
              </div>
            </div>

            {/* Previous Announcements */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Previous Announcements ({announcements.length})</h3>
              {announcements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((announcement: any) => {
                    const targets = [
                      announcement.target_students ? 'Students' : '',
                      announcement.target_housekeeping ? 'Housekeeping' : '',
                      announcement.target_maintenance ? 'Maintenance' : '',
                      announcement.target_routine_checkup ? 'Routine Checkup' : '',
                    ].filter(Boolean);
                    return (
                      <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-wrap gap-1">
                            {targets.map((t) => (
                              <span key={t} className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-medium">{t}</span>
                            ))}
                            {targets.length === 0 && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">No recipients</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                            {new Date(announcement.created_at).toLocaleString()}
                          </span>
                        </div>
                        {announcement.title && (
                          <p className="font-medium text-gray-900 mb-1">{announcement.title}</p>
                        )}
                        <p className="text-gray-700">{announcement.content}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'complaints' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-sky-600" />
                  Student Complaints & Feedback ({complaints.length})
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">Filter:</label>
                  <select
                    value={complaintStatusFilter}
                    onChange={(e) => setComplaintStatusFilter(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="all">All</option>
                    <option value="received">Received</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
              {(() => {
                const filtered = complaintStatusFilter === 'all'
                  ? complaints
                  : complaints.filter((c: any) => c.status === complaintStatusFilter);
                return filtered.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No complaints found</p>
                ) : (
                <div className="space-y-4">
                  {filtered.map((complaint: any) => (
                    <div key={complaint.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              complaint.type === 'Complaint' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {complaint.type}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              complaint.status === 'received' ? 'bg-orange-100 text-orange-700' :
                              complaint.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1)}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900">{complaint.subject}</h4>
                          <p className="text-sm text-gray-600 mt-1">{complaint.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span>Student: {complaint.user_name}</span>
                            <span>Room: {complaint.room_number}</span>
                            <span>Submitted: {new Date(complaint.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
                          <select
                            value={complaint.status}
                            onChange={(e) => handleUpdateComplaintStatus(complaint.id, e.target.value, complaint.student_id)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          >
                            <option value="received">Received</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>

                      {/* Comments */}
                      {complaint.complaint_comments && complaint.complaint_comments.length > 0 && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Follow-up Comments:</p>
                          <div className="space-y-2">
                            {complaint.complaint_comments.map((comment: any) => (
                              <div key={comment.id} className="bg-white rounded p-3 text-sm">
                                <p className="text-gray-900">{comment.comment}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(comment.created_at).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-sky-600" />
                  Staff Attendance
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {users.filter((u: any) => u.role === 'staff').length === 0 ? (
                <p className="text-gray-500 text-center py-8">No staff members found</p>
              ) : (
                <div className="space-y-3">
                  {users.filter((u: any) => u.role === 'staff').map((staff: any) => {
                    const staffAttendance = attendance.find((a: any) => a.staff_id === staff.id);
                    const currentStatus = staffAttendance?.status;

                    return (
                      <div key={staff.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{staff.name}</h4>
                            <p className="text-sm text-gray-600">
                              {staff.staff_type?.replace('_', ' ') || 'Staff'} • Email: {staff.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleMarkAttendance(staff.id, 'present')}
                              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                currentStatus === 'present'
                                  ? 'bg-green-600 text-white'
                                  : 'border-2 border-green-600 text-green-600 hover:bg-green-50'
                              }`}
                            >
                              <CheckCircle className="w-4 h-4 inline mr-1" />
                              Present
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(staff.id, 'absent')}
                              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                currentStatus === 'absent'
                                  ? 'bg-red-600 text-white'
                                  : 'border-2 border-red-600 text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <AlertCircle className="w-4 h-4 inline mr-1" />
                              Absent
                            </button>
                          </div>
                        </div>
                        {currentStatus && (
                          <div className="mt-2 text-xs text-gray-500">
                            Status: <span className={`font-medium ${currentStatus === 'present' ? 'text-green-600' : 'text-red-600'}`}>
                              {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity-log' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-sky-600" />
                Admin Activity Log
              </h3>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
                  <select
                    value={activityLogType}
                    onChange={(e) => setActivityLogType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="all">All</option>
                    <option value="announcement_sent">Announcement Sent</option>
                    <option value="flag_removed_individual">Flag Removed (Individual)</option>
                    <option value="flag_removed_all">Flag Removed (All)</option>
                    <option value="checkup_slots_cancelled">Checkup Slots Cancelled</option>
                    <option value="checkup_created">Checkup Created</option>
                    <option value="waitlist_created">Waitlist Created</option>
                    <option value="attendance_marked">Attendance Marked</option>
                    <option value="complaint_updated">Complaint Updated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={activityLogStart}
                    onChange={(e) => setActivityLogStart(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={activityLogEnd}
                    onChange={(e) => setActivityLogEnd(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {activityLog.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No activity log entries found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityLog.map((entry: any) => (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              entry.action_type === 'announcement_sent' ? 'bg-sky-100 text-sky-700' :
                              entry.action_type.includes('flag') ? 'bg-red-100 text-red-700' :
                              entry.action_type.includes('checkup') || entry.action_type === 'create_checkup' ? 'bg-orange-100 text-orange-700' :
                              entry.action_type === 'create_waitlist' ? 'bg-purple-100 text-purple-700' :
                              entry.action_type === 'attendance_marked' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {entry.action_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700">{entry.description}</td>
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                            {new Date(entry.performed_at ?? entry.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'room-history' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-sky-600" />
                Room Task History
              </h3>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Number</label>
                  <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Select Room</option>
                    {roomNumbers.map((room: any) => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Task Type</label>
                  <select
                    value={historyTaskType}
                    onChange={(e) => setHistoryTaskType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="all">All</option>
                    <option value="housekeeping">Housekeeping</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="emergency">Emergency</option>
                    <option value="routine_checkup">Routine Checkup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* History Table */}
              {!selectedRoom ? (
                <p className="text-gray-500 text-center py-8">Please select a room to view history</p>
              ) : roomHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No task history found for this room</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Task Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Student Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Staff Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Completed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomHistory.map((task: any) => (
                        <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              task.task_type === 'Emergency' ? 'bg-red-100 text-red-700' :
                              task.task_type === 'Routine Checkup' ? 'bg-purple-100 text-purple-700' :
                              task.task_type === 'housekeeping' ? 'bg-sky-100 text-sky-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4">{task.date || 'N/A'}</td>
                          <td className="py-3 px-4">{task.time || 'N/A'}</td>
                          <td className="py-3 px-4">{task.user_name || 'N/A'}</td>
                          <td className="py-3 px-4">{task.assigned_staff_name || 'N/A'}</td>
                          <td className="py-3 px-4">
                            {(() => {
                              const s = task.display_status || task.status;
                              const cls =
                                s === 'completed' ? 'bg-green-100 text-green-700' :
                                s === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                s === 'door_not_opened' ? 'bg-red-100 text-red-700' :
                                s === 'cancelled_by_admin' ? 'bg-gray-200 text-gray-700' :
                                s === 'cancelled_by_student' ? 'bg-gray-100 text-gray-500' :
                                s === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                                'bg-orange-100 text-orange-700';
                              const label =
                                s === 'door_not_opened' ? 'Door Not Opened' :
                                s === 'cancelled_by_admin' ? 'Cancelled by Admin' :
                                s === 'cancelled_by_student' ? 'Cancelled by Student' :
                                s.replace(/_/g, ' ');
                              return (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>
                                  {label.charAt(0).toUpperCase() + label.slice(1)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4">
                            {task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
