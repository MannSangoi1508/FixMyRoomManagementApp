import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Filter, X, User, Home, Clock, Sparkles, Wrench, AlertCircle } from 'lucide-react';

interface ScheduleOverviewProps {
  session: any;
  userRole: string;
}

export default function ScheduleOverview({ session, userRole }: ScheduleOverviewProps) {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [filterHostel, setFilterHostel] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 10000);
    return () => clearInterval(interval);
  }, []);

  const normalise = (rows: any[]) =>
    rows.map((b: any) => ({
      ...b,
      date: b.date ?? b.booking_date ?? today,
      time_slot: b.time_slot ?? b.slot ?? '',
      time: (b.time_slot ?? b.slot ?? '').split('-')[0],
      hostel: b.hostel ?? b.hostel_number ?? '',
      floor: b.floor ?? b.floor_number ?? '',
      service_type: b.service_type ?? 'housekeeping',
      status: b.status ?? 'pending',
      user_name: b.user_name ?? b.student_name ?? '',
    }));

  const fetchSchedule = async () => {
    setFetchError('');
    try {
      if (userRole === 'student') {
        const { data, error } = await supabase
          .from('student_today_schedule')
          .select('*');
        if (error) throw error;
        setSchedule(normalise(data || []));
      } else {
        // Try admin_schedule_overview view first — order only by date to avoid column-not-found errors
        const { data: viewData, error: viewError } = await supabase
          .from('admin_schedule_overview')
          .select('*')
          .order('date', { ascending: true });

        if (!viewError && viewData) {
          setSchedule(normalise(viewData));
        } else {
          // Fallback: query bookings directly so the screen is never empty
          console.warn('admin_schedule_overview failed, falling back to bookings table:', viewError?.message);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('bookings')
            .select('*')
            .order('date', { ascending: true });

          if (fallbackError) throw fallbackError;
          setSchedule(normalise(fallbackData || []));
          if (viewError) setFetchError('Note: using direct bookings data (view unavailable)');
        }
      }
    } catch (error: any) {
      console.error('Error fetching schedule:', error);
      setFetchError(error.message ?? 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedule = schedule.filter((booking: any) => {
    if (filterHostel !== 'all' && String(booking.hostel) !== String(filterHostel)) return false;
    if (filterFloor !== 'all' && String(booking.floor) !== String(filterFloor)) return false;
    if (filterService !== 'all' && booking.service_type !== filterService) return false;
    if (filterStatus !== 'all' && booking.status !== filterStatus) return false;
    if (filterDate && booking.date !== filterDate) return false;
    return true;
  });

  const groupedByDate = filteredSchedule.reduce((acc: any, booking: any) => {
    if (!acc[booking.date]) acc[booking.date] = [];
    acc[booking.date].push(booking);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort();

  const hostels = [...new Set(schedule.map((b: any) => b.hostel))].filter(Boolean);
  const floors = [...new Set(schedule.map((b: any) => String(b.floor)))].filter(Boolean).sort();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getServiceBorderColor = (booking: any) => {
    if (booking.is_emergency) return 'border-l-4 border-l-red-600';
    if (booking.service_type === 'housekeeping') return 'border-l-4 border-l-sky-600';
    if (booking.service_type === 'routine_checkup') return 'border-l-4 border-l-purple-600';
    return 'border-l-4 border-l-orange-600';
  };

  const getServiceIcon = (booking: any) => {
    if (booking.service_type === 'housekeeping') return <Sparkles className="w-5 h-5 text-sky-600" />;
    if (booking.service_type === 'routine_checkup') return <Clock className="w-5 h-5 text-purple-600" />;
    return <Wrench className="w-5 h-5 text-orange-600" />;
  };

  const getServiceLabel = (booking: any) => {
    if (booking.is_emergency) return 'Emergency';
    if (booking.service_type === 'routine_checkup') return 'Routine Checkup';
    return booking.service_type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Title for student */}
      {userRole === 'student' && (
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Today's Schedule</h2>
          <p className="text-sm text-gray-500">{new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      )}

      {/* Filters — admin only */}
      {userRole !== 'student' && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hostel</label>
              <select value={filterHostel} onChange={(e) => setFilterHostel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none">
                <option value="all">All Hostels</option>
                {hostels.map((hostel: any) => (
                  <option key={hostel} value={hostel}>Hostel {hostel}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
              <select value={filterFloor} onChange={(e) => setFilterFloor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none">
                <option value="all">All Floors</option>
                {floors.map((floor: any) => (
                  <option key={floor} value={floor}>Floor {floor}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
              <select value={filterService} onChange={(e) => setFilterService(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none">
                <option value="all">All Services</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none">
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none" />
            </div>
          </div>
          {fetchError && (
            <div className="mt-4 flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {fetchError}
            </div>
          )}
          {(filterHostel !== 'all' || filterFloor !== 'all' || filterService !== 'all' || filterStatus !== 'all' || filterDate) && (
            <button
              onClick={() => { setFilterHostel('all'); setFilterFloor('all'); setFilterService('all'); setFilterStatus('all'); setFilterDate(''); }}
              className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-md border border-sky-100">
          <p className="text-sm text-gray-600">Total Bookings</p>
          <p className="text-2xl font-bold text-sky-600">{filteredSchedule.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md border border-sky-100">
          <p className="text-sm text-gray-600">Housekeeping</p>
          <p className="text-2xl font-bold text-sky-600">
            {filteredSchedule.filter((b: any) => b.service_type === 'housekeeping').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md border border-orange-100">
          <p className="text-sm text-gray-600">Maintenance</p>
          <p className="text-2xl font-bold text-orange-600">
            {filteredSchedule.filter((b: any) => b.service_type === 'maintenance').length}
          </p>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-gray-900">
            {userRole === 'student' ? "Today's Bookings" : 'Schedule Overview'}
          </h2>
        </div>

        {sortedDates.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {userRole === 'student' ? 'No bookings scheduled for today' : 'No bookings found'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date) => {
              const isToday = date === today;
              return (
                <div key={date}>
                  <h3 className={`text-md font-bold mb-3 flex items-center gap-2 ${isToday ? 'text-sky-700' : 'text-gray-900'}`}>
                    <Calendar className={`w-4 h-4 ${isToday ? 'text-sky-600' : 'text-gray-500'}`} />
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                    {isToday && (
                      <span className="ml-1 px-2 py-0.5 bg-sky-600 text-white text-xs rounded-full">Today</span>
                    )}
                    <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${isToday ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                      {groupedByDate[date].length} booking{groupedByDate[date].length !== 1 ? 's' : ''}
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {groupedByDate[date]
                      .sort((a: any, b: any) => (a.time_slot ?? '').localeCompare(b.time_slot ?? ''))
                      .map((booking: any) => (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-all ${getServiceBorderColor(booking)} bg-white`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getServiceIcon(booking)}
                              <span className="font-medium text-gray-900 capitalize">{getServiceLabel(booking)}</span>
                              {booking.is_emergency && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded font-medium">Emergency</span>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(booking.status)}`}>
                              {booking.status?.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-4 h-4" />
                              {(booking.time_slot ?? '').split('-').slice(0, 2).join('-')}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Home className="w-4 h-4" />
                              Room {booking.room_number} • Hostel {booking.hostel} • Floor {booking.floor}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <User className="w-4 h-4" />
                              {booking.user_name}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl">
            <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold capitalize">{getServiceLabel(selectedBooking)} Booking</h2>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(selectedBooking.status)}`}>
                    {selectedBooking.status?.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Service Type</p>
                  <p className="font-medium text-gray-900 capitalize">{getServiceLabel(selectedBooking)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Date</p>
                  <p className="font-medium text-gray-900">{selectedBooking.date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Time Slot</p>
                  <p className="font-medium text-gray-900">{(selectedBooking.time_slot ?? '').split('-').slice(0, 2).join('-')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Student Name</p>
                  <p className="font-medium text-gray-900">{selectedBooking.user_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Room Number</p>
                  <p className="font-medium text-gray-900">
                    Room {selectedBooking.room_number} • Hostel {selectedBooking.hostel} • Floor {selectedBooking.floor}
                  </p>
                </div>
                {selectedBooking.assigned_staff_name && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 mb-1">Assigned Staff</p>
                    <p className="font-medium text-gray-900">{selectedBooking.assigned_staff_name}</p>
                  </div>
                )}
              </div>

              {selectedBooking.notes && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedBooking.notes}</p>
                </div>
              )}

              {selectedBooking.is_emergency && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 font-medium">🚨 Emergency Booking</p>
                </div>
              )}

              {selectedBooking.photos && selectedBooking.photos.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Uploaded Photos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedBooking.photos.map((photo: string, index: number) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedBooking.created_at && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-500">Created: {new Date(selectedBooking.created_at).toLocaleString()}</p>
                  {selectedBooking.updated_at && (
                    <p className="text-xs text-gray-500">Last Updated: {new Date(selectedBooking.updated_at).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
