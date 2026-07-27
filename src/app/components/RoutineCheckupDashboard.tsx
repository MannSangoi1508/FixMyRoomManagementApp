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

interface RoutineCheckupDashboardProps {
  user: any;
  session: any;
  onSignOut: () => void;
}

export default function RoutineCheckupDashboard({ user, session, onSignOut }: RoutineCheckupDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeTasks, setActiveTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [checkups, setCheckups] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    checkAndPerformWeeklyReset();
    fetchTasks();
    fetchCheckups();
    fetchAnnouncements();
    fetchUnreadAnnouncementCount();

    const sub = supabase
      .channel('checkup-staff-' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'staff_tasks',
        filter: `assigned_to=eq.${user.id}`
      }, () => fetchTasks())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [user]);

  const [checkupQueue, setCheckupQueue] = useState<any[]>([]);

  const fetchCheckups = async () => {
    try {
      // Upcoming events (date >= today) from the new view
      const { data: eventsData, error: eventsErr } = await supabase
        .from('routine_checkup_events_upcoming')
        .select('*')
        .order('date', { ascending: true });

      if (eventsErr) throw eventsErr;
      setCheckups(eventsData || []);

      // Today's queue — ordered by time_slot, excludes completed/cancelled/door-not-opened
      const { data: queueData, error: queueErr } = await supabase
        .from('routine_checkup_queue')
        .select('*')
        .order('time_slot', { ascending: true });

      if (queueErr) throw queueErr;
      setCheckupQueue(queueData || []);
    } catch (error) {
      console.error('Error fetching routine checkups:', error);
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
        .eq('target_routine_checkup', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const fetchTaskCounts = async () => {
    try {
      const weekStart = getMonday().toISOString();

      const { data: tasks } = await supabase
        .from('staff_tasks')
        .select('id, status, completed_at')
        .eq('staff_type', 'routine_checkup')
        .eq('assigned_to', user.id);

      const pending = (tasks ?? []).filter(t => t.status === 'pending').length;
      const inProgress = (tasks ?? []).filter(t => t.status === 'in_progress').length;
      const completed = (tasks ?? []).filter(
        t => t.status === 'completed' && new Date(t.completed_at) >= new Date(weekStart)
      ).length;

      setPendingCount(pending);
      setInProgressCount(inProgress);
      setCompletedCount(completed);
    } catch (error) {
      console.error('Error fetching task counts:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const weekStart = getMonday().toISOString();

      // Active tasks — slots whose time has arrived but are not yet completed/cancelled
      const { data: activeTasks, error: activeErr } = await supabase
        .from('routine_checkup_active_tasks')
        .select('*');
      if (activeErr) console.error('routine_checkup_active_tasks error:', activeErr.message);

      // Completed this week only
      const { data: completedTasks } = await supabase
        .from('staff_tasks')
        .select('*')
        .eq('staff_type', 'routine_checkup')
        .eq('assigned_to', user.id)
        .eq('status', 'completed')
        .gte('completed_at', weekStart)
        .order('completed_at', { ascending: false });

      setActiveTasks(activeTasks ?? []);
      setCompletedTasks(completedTasks ?? []);
      fetchTaskCounts();
    } catch (error) {
      console.error('Error fetching routine checkup tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (task: any) => {
    if (!task.task_id) {
      alert('No staff task linked to this slot yet.');
      return;
    }
    try {
      const { error } = await supabase.rpc('start_checkup_task', {
        p_task_id: task.task_id,
      });

      if (error) throw error;
      fetchTasks();
    } catch (error: any) {
      alert('Failed to start task: ' + error.message);
    }
  };

  const handleEndTask = async (task: any) => {
    try {
      const { data, error } = await supabase.rpc('complete_checkup_task', {
        p_task_id: task.task_id,
        p_staff_id: user.id
      });

      if (error || !data?.success) {
        alert(data?.error ?? 'Failed to complete task');
        return;
      }
      fetchTasks();
    } catch (error: any) {
      alert('Failed to complete task: ' + error.message);
    }
  };

  const handleDoorNotOpened = async (task: any) => {
    if (!confirm(`Report door not opened for this checkup? This will mark it as completed (no-show).`)) return;
    try {
      const { data, error } = await supabase.rpc('report_door_not_opened', {
        p_booking_id: task.task_id,
        p_staff_id: user.id,
      });

      if (error || !data?.success) {
        alert(data?.error ?? error?.message ?? 'Failed to report door not opened');
        return;
      }
      alert('Door not opened report filed successfully');
      fetchTasks();
    } catch (error: any) {
      alert('Failed to report door not opened: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
          <p className="mt-4 text-purple-600 font-medium">Loading Tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-gradient-to-br from-purple-50 to-white">
      <div className="bg-white border-b border-purple-100 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-purple-900">Routine Checkup Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell userId={user.id} accentColor="purple" />
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
      <div className="bg-white border-b border-purple-100 px-6 shadow-sm">
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
                activeTab === id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-purple-600'
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
            <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pending</p>
                  <p className="text-4xl font-bold text-purple-600 mt-1">{pendingCount}</p>
                </div>
                <Clock className="w-10 h-10 text-purple-600" />
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

          {/* Active Tasks */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Active Tasks</h3>
            {activeTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No active tasks</p>
            ) : (
              <div className="space-y-3">
                {activeTasks.map((task: any) => {
                  const taskStatus = task.status ?? 'pending';
                  const taskTitle = task.title ?? `Room ${task.room_number ?? ''} — ${task.time_slot ?? task.slot_time ?? ''}`;
                  const rowKey = task.slot_id ?? task.id ?? task.staff_task_id ?? task.checkup_id ?? JSON.stringify(task);
                  return (
                    <div key={rowKey} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench className="w-5 h-5 text-purple-600" />
                            <h4 className="font-medium text-gray-900">{taskTitle}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              taskStatus === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {taskStatus.replace('_', ' ')}
                            </span>
                          </div>
                          {(task.student_name || task.room_number) && (
                            <p className="text-sm text-gray-600 mb-1">
                              {task.student_name && <span>Student: {task.student_name}</span>}
                              {task.student_name && task.room_number && ' · '}
                              {task.room_number && <span>Room {task.room_number}</span>}
                            </p>
                          )}
                          {task.description && (
                            <p className="text-sm text-gray-500 mb-2">{task.description}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          {taskStatus === 'pending' && (
                            <>
                              {task.task_id ? (
                                <button
                                  onClick={() => handleStartTask(task)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Start Task
                                </button>
                              ) : (
                                <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg">
                                  No staff task linked yet
                                </span>
                              )}
                              <button
                                onClick={() => handleDoorNotOpened(task)}
                                disabled={!task.task_id}
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <DoorOpen className="w-4 h-4 inline mr-1" />
                                Door Not Opened
                              </button>
                            </>
                          )}
                          {taskStatus === 'in_progress' && (
                            <button
                              onClick={() => handleEndTask(task)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              End Task
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completed This Week */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Completed This Week</h3>
            {completedTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No completed tasks this week</p>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task: any) => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Wrench className="w-5 h-5 text-green-600" />
                          <h4 className="font-medium text-gray-900">{task.title}</h4>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                            Completed ✓
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Checkup Queue */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-purple-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Today's Checkup Queue</h3>
            <p className="text-sm text-gray-500 mb-4">Rooms remaining today, ordered by time slot</p>
            {checkupQueue.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No pending checkups for today</p>
            ) : (
              <div className="space-y-3">
                {/* Next up — highlighted */}
                <div className="border-2 border-purple-400 rounded-xl p-4 bg-purple-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded font-medium">Next Up</span>
                    <span className="text-sm text-purple-700 font-medium">{checkupQueue[0].time_slot}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    Room {checkupQueue[0].room_number} — {checkupQueue[0].student_name || 'Student'}
                  </p>
                  <p className="text-sm text-gray-600">Hostel {checkupQueue[0].hostel} • Floor {checkupQueue[0].floor}</p>
                </div>
                {/* Remaining count */}
                {checkupQueue.length > 1 && (
                  <p className="text-sm text-gray-500 pl-1">
                    +{checkupQueue.length - 1} more room{checkupQueue.length - 1 !== 1 ? 's' : ''} after this
                  </p>
                )}
                {/* Rest of queue collapsed */}
                {checkupQueue.slice(1).map((slot: any) => (
                  <div key={slot.id} className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-gray-700">
                    <span className="font-medium">{slot.time_slot}</span>
                    <span>Room {slot.room_number} — {slot.student_name || 'Student'}</span>
                    <span className="text-gray-400 text-xs">H{slot.hostel} F{slot.floor}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Checkup Events */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Upcoming Checkup Events ({checkups.length})</h3>
            {checkups.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No upcoming checkups scheduled</p>
            ) : (
              <div className="space-y-3">
                {checkups.map((checkup: any) => (
                  <div key={checkup.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-5 h-5 text-purple-600" />
                      <h4 className="font-medium text-gray-900">
                        Hostel {checkup.hostel} • Floor {checkup.floor}
                      </h4>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        {checkup.booked_slots ?? checkup.booked_count ?? '?'}/{checkup.total_slots ?? '?'} booked
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {checkup.date}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {checkup.time_window}
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
            <div className="bg-white rounded-xl p-6 shadow-md border border-purple-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-600" />
                Announcements
              </h2>
              {announcements.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No announcements yet</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
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
