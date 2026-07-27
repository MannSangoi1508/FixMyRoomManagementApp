import { useState, useEffect } from 'react';
import { projectId } from '../../../utils/supabase/info';
import { supabase } from '../supabaseClient';
import {
  Home,
  Calendar,
  LogOut,
  Clock,
  CheckCircle,
  Play,
  Filter,
  Sparkles,
  Wrench,
  Building2,
  Layers,
  DoorOpen,
} from 'lucide-react';
import ScheduleOverview from './ScheduleOverview';

interface StaffDashboardProps {
  user: any;
  session: any;
  onSignOut: () => void;
}

export default function StaffDashboard({ user, session, onSignOut }: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterHostel, setFilterHostel] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');

  // Determine which service type this staff member handles
  const staffType = user.staffType || user.staff_type || 'housekeeping';
  const serviceFilter = staffType === 'maintenance' ? 'maintenance' : 'housekeeping';
  const dashboardTitle =
    staffType === 'maintenance'
      ? 'Maintenance Dashboard'
      : staffType === 'routine_checkup'
      ? 'Routine Checkup Dashboard'
      : 'Housekeeping Dashboard';

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('staff-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => { fetchTasks(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4438cc7c/staff/tasks`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4438cc7c/staff/tasks/${taskId}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ status }),
        }
      );
      if (response.ok) {
        fetchTasks();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update task status');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status');
    }
  };

  const handleDoorNotOpened = async (task: any) => {
    if (!confirm(`Report door not opened for ${task.user_name}? This will mark the booking as completed (no-show).`)) return;
    try {
      const { data, error } = await supabase.rpc('report_door_not_opened', {
        p_booking_id: task.id,
        p_staff_id: user.id,
      });

      if (error) {
        console.error('Error reporting door not opened:', error);
        alert(error.message || 'Failed to submit report');
        return;
      }

      if (data?.success) {
        alert('Door not opened report submitted. Booking marked as completed (no-show).');
        fetchTasks(); // Refresh task list
      } else {
        alert('Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting door not opened report:', error);
      alert('Failed to submit report');
    }
  };

  // Filter tasks: only show tasks matching this staff's service type
  const myTasks = tasks.filter((task: any) => task.assigned_staff === user.id);
  const unassignedTasks = tasks.filter((task: any) => !task.assigned_staff && task.status === 'pending');

  const relevantTasks = [...myTasks, ...unassignedTasks].filter((task: any) => {
    if (staffType !== 'routine_checkup' && task.service_type !== serviceFilter) return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterHostel !== 'all' && task.hostel !== filterHostel) return false;
    if (filterFloor !== 'all' && task.floor !== filterFloor) return false;
    return true;
  });

  const pendingCount = relevantTasks.filter((t: any) => t.status === 'pending').length;
  const inProgressCount = relevantTasks.filter((t: any) => t.status === 'in_progress').length;
  const completedCount = relevantTasks.filter((t: any) => t.status === 'completed').length;

  const hostels = [...new Set(tasks.map((t: any) => t.hostel))].filter(Boolean);
  const floors = [...new Set(tasks.map((t: any) => t.floor))].filter(Boolean);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-sky-600 font-medium">Loading Tasks...</p>
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
            <h1 className="text-2xl font-bold text-sky-900">FixMyRoom — {dashboardTitle}</h1>
            <p className="text-sm text-gray-600">Welcome, {user.name}</p>
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

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-sky-100 px-6 shadow-sm">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'tasks' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
            }`}
          >
            <Home className="w-4 h-4" />
            My Tasks
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'schedule' ? 'border-sky-600 text-sky-600' : 'border-transparent text-gray-600 hover:text-sky-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'tasks' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Live Counts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-md border border-orange-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{pendingCount}</p>
                  </div>
                  <Clock className="w-10 h-10 text-orange-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">In Progress</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{inProgressCount}</p>
                  </div>
                  <Play className="w-10 h-10 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{completedCount}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-sky-600" />
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hostel</label>
                  <select
                    value={filterHostel}
                    onChange={(e) => setFilterHostel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                  >
                    <option value="all">All Hostels</option>
                    {hostels.map((hostel: any) => (
                      <option key={hostel} value={hostel}>Hostel {hostel}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
                  <select
                    value={filterFloor}
                    onChange={(e) => setFilterFloor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                  >
                    <option value="all">All Floors</option>
                    {floors.map((floor: any) => (
                      <option key={floor} value={floor}>Floor {floor}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tasks List */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Tasks</h2>
              {relevantTasks.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No tasks found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relevantTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className={`border-2 rounded-lg p-5 transition-all ${
                        task.is_emergency ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {task.service_type === 'housekeeping' ? (
                              <Sparkles className="w-5 h-5 text-sky-600" />
                            ) : (
                              <Wrench className="w-5 h-5 text-orange-600" />
                            )}
                            <h3 className="font-bold text-gray-900 capitalize text-lg">{task.service_type}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                            {task.is_emergency && (
                              <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium">
                                🚨 EMERGENCY
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Building2 className="w-4 h-4" />
                              Room {task.room_number} • Hostel {task.hostel}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Layers className="w-4 h-4" />
                              Floor {task.floor}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4" />
                              {task.date} • {(task.time_slot ?? '').split('-').slice(0, 2).join('-')}
                            </div>
                            <div className="text-gray-600">
                              Student: <span className="font-medium">{task.user_name}</span>
                            </div>
                          </div>

                          {task.notes && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-700">
                                <span className="font-medium">Notes:</span> {task.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-4 pt-4 border-t flex-wrap">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                          >
                            <Play className="w-4 h-4" />
                            Start Task
                          </button>
                        )}
                        {task.status === 'in_progress' && task.assigned_staff === user.id && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'completed')}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                          >
                            <CheckCircle className="w-4 h-4" />
                            End Task
                          </button>
                        )}
                        {task.status === 'completed' && (
                          <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-100 text-green-700 rounded-lg font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Completed
                          </div>
                        )}
                        {(task.status === 'pending' || task.status === 'in_progress') && (
                          <button
                            onClick={() => handleDoorNotOpened(task)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                          >
                            <DoorOpen className="w-4 h-4" />
                            Door Not Opened
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleOverview session={session} userRole="staff" />}
      </div>
    </div>
  );
}
