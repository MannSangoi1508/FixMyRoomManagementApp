import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  Home,
  LogOut,
  Clock,
  CheckCircle,
  Play,
  Wrench,
  Building2,
  Layers,
  DoorOpen,
  Mail,
} from 'lucide-react';
import { checkAndPerformWeeklyReset, getMonday } from '../utils/weeklyReset';
import NotificationBell from './NotificationBell';

interface MaintenanceDashboardProps {
  user: any;
  session: any;
  onSignOut: () => void;
}

export default function MaintenanceDashboard({ user, session, onSignOut }: MaintenanceDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [hostelFilter, setHostelFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  useEffect(() => {
    checkAndPerformWeeklyReset();
    fetchUpcomingBookings();
    fetchCompletedBookings();
    fetchAnnouncements();
    fetchUnreadAnnouncementCount();

    const channel = supabase
      .channel('maintenance-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchUpcomingBookings();
        fetchCompletedBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateFilter, hostelFilter, floorFilter]);

  const fetchUpcomingBookings = async () => {
    try {
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('service_type', 'maintenance')
        .in('status', ['pending', 'in_progress']);

      if (dateFilter !== 'all') {
        query = query.eq('date', dateFilter);
      }

      if (hostelFilter !== 'all') {
        query = query.eq('hostel', hostelFilter);
      }

      if (floorFilter !== 'all') {
        query = query.eq('floor', floorFilter);
      }

      const { data, error } = await query.order('time_slot', { ascending: true });

      if (error) throw error;
      setUpcomingBookings(data || []);
    } catch (error) {
      console.error('Error fetching upcoming bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedBookings = async () => {
    try {
      const weekStart = getMonday().toISOString();

      let query = supabase
        .from('bookings')
        .select('*')
        .eq('service_type', 'maintenance')
        .eq('status', 'completed')
        .gte('completed_at', weekStart);

      if (hostelFilter !== 'all') {
        query = query.eq('hostel', hostelFilter);
      }

      if (floorFilter !== 'all') {
        query = query.eq('floor', floorFilter);
      }

      const { data, error } = await query.order('completed_at', { ascending: false });

      if (error) throw error;
      setCompletedBookings(data || []);
    } catch (error) {
      console.error('Error fetching completed bookings:', error);
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
        .eq('target_maintenance', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'in_progress', assigned_staff: user.id, assigned_staff_name: user.name })
        .eq('id', taskId);

      if (error) throw error;
      fetchUpcomingBookings();
      fetchCompletedBookings();
    } catch (error: any) {
      alert('Failed to start task: ' + error.message);
    }
  };

  const handleEndTask = async (taskId: string) => {
    try {
      const { data, error } = await supabase.rpc('complete_task', {
        p_booking_id: taskId,
        p_staff_id: user.id
      });

      if (error || !data?.success) {
        alert(data?.error ?? 'Failed to complete task');
        return;
      }
      fetchUpcomingBookings();
      fetchCompletedBookings();
    } catch (error: any) {
      alert('Failed to complete task: ' + error.message);
    }
  };

  const handleDoorNotOpened = async (task: any) => {
    if (!confirm(`Report door not opened for this task? This will mark it as completed (no-show).`)) return;
    try {
      const { data, error } = await supabase.rpc('report_door_not_opened', {
        p_booking_id: task.id,
        p_staff_id: user.id,
      });

      if (error || !data?.success) {
        alert(data?.error ?? 'Failed to report door not opened');
        return;
      }
      alert('Door not opened report filed successfully');
      fetchUpcomingBookings();
      fetchCompletedBookings();
    } catch (error: any) {
      alert('Failed to report door not opened: ' + error.message);
    }
  };

  const pendingCount = upcomingBookings.filter((t: any) => t.status === 'pending').length;
  const inProgressCount = upcomingBookings.filter((t: any) => t.status === 'in_progress').length;
  const completedCount = completedBookings.length;

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
          <p className="mt-4 text-orange-600 font-medium">Loading Tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-gradient-to-br from-orange-50 to-white">
      <div className="bg-white border-b border-orange-100 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-orange-900">Maintenance Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userId={user.id} accentColor="orange" />
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
      <div className="bg-white border-b border-orange-100 px-6 shadow-sm">
        <div className="flex gap-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'announcements', label: 'Announcements', icon: Mail },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                if (id === 'announcements') markAnnouncementsRead();
              }}
              className={`relative flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === id ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-600 hover:text-orange-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'announcements' && unreadAnnouncementCount > 0 && (
                <span className="ml-0.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-medium">
                  {unreadAnnouncementCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'dashboard' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Task Counter */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pending</p>
                  <p className="text-4xl font-bold text-orange-600 mt-1">{pendingCount}</p>
                </div>
                <Clock className="w-10 h-10 text-orange-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">In Progress</p>
                  <p className="text-4xl font-bold text-blue-600 mt-1">{inProgressCount}</p>
                </div>
                <Play className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md border border-green-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Completed</p>
                  <p className="text-4xl font-bold text-green-600 mt-1">{completedCount}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                {dateFilter !== 'all' && (
                  <button
                    onClick={() => setDateFilter('all')}
                    className="text-xs text-orange-600 hover:text-orange-700 mt-1"
                  >
                    Clear date filter
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hostel</label>
                <select
                  value={hostelFilter}
                  onChange={(e) => setHostelFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">All</option>
                  <option value="H1">H1</option>
                  <option value="H2">H2</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">All</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(floor => (
                    <option key={floor} value={floor}>{floor}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Upcoming Bookings */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Bookings ({upcomingBookings.length})</h3>
            {upcomingBookings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No upcoming bookings</p>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((task: any) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Wrench className="w-5 h-5 text-orange-600" />
                          <h4 className="font-medium text-gray-900">{task.user_name}</h4>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            Maintenance
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Room {task.room_number}
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Hostel {task.hostel}
                          </div>
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Floor {task.floor}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {task.date} {task.time_slot?.split('-')[0]}
                          </div>
                        </div>
                        {task.notes && (
                          <p className="text-sm text-gray-600 mt-2"><strong>Notes:</strong> {task.notes}</p>
                        )}
                        {task.photos && task.photos.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Photos:</p>
                            <div className="flex gap-2 flex-wrap">
                              {task.photos.map((url: string, i: number) => (
                                <img
                                  key={i}
                                  src={url}
                                  alt={`Photo ${i + 1}`}
                                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(url, '_blank')}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        {task.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStartTask(task.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Start Task
                            </button>
                            <button
                              onClick={() => handleDoorNotOpened(task)}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-sm"
                            >
                              <DoorOpen className="w-4 h-4 inline mr-1" />
                              Door Not Opened
                            </button>
                          </>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleEndTask(task.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            End Task
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Bookings */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Completed Bookings This Week ({completedBookings.length})</h3>
            {completedBookings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No completed bookings this week</p>
            ) : (
              <div className="space-y-3">
                {completedBookings.map((task: any) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Wrench className="w-5 h-5 text-green-600" />
                          <h4 className="font-medium text-gray-900">{task.user_name}</h4>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            Maintenance
                          </span>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                            Completed ✓
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Room {task.room_number}
                          </div>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Hostel {task.hostel}
                          </div>
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Floor {task.floor}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {task.date} {task.time_slot?.split('-')[0]}
                          </div>
                        </div>
                        {task.notes && (
                          <p className="text-sm text-gray-600 mt-2"><strong>Notes:</strong> {task.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-orange-600" />
                Announcements
              </h2>
              {announcements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
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
      </div>
    </div>
  );
}
