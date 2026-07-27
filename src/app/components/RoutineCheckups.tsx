import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Calendar, Building2, Layers, Clock, Wrench, X, AlertCircle, Ban, Users } from 'lucide-react';

interface RoutineCheckupsProps {
  session: any;
  user?: any;
  logAdminAction?: (actionType: string, description: string) => Promise<void>;
}

function addMinutes(time: string, mins: number): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

export default function RoutineCheckups({ session, user, logAdminAction }: RoutineCheckupsProps) {
  const [checkups, setCheckups] = useState([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedCheckup, setExpandedCheckup] = useState<string | null>(null);

  // Create form state
  const [hostel, setHostel] = useState('H1');
  const [floor, setFloor] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [slotDuration, setSlotDuration] = useState(5);
  const [customDuration, setCustomDuration] = useState('');
  const [numSlots, setNumSlots] = useState(32);
  const [customNumSlots, setCustomNumSlots] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Cancel slots state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelCheckup, setCancelCheckup] = useState<any>(null);
  const [cancelStartTime, setCancelStartTime] = useState('');
  const [cancelEndTime, setCancelEndTime] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Schedule Waitlist Session state
  const [showWaitlistScheduleForm, setShowWaitlistScheduleForm] = useState(false);
  const [waitlistScheduleCheckup, setWaitlistScheduleCheckup] = useState<any>(null);
  const [waitlistScheduleDate, setWaitlistScheduleDate] = useState('');
  const [waitlistScheduleStartTime, setWaitlistScheduleStartTime] = useState('');
  const [waitlistScheduleSlotDuration, setWaitlistScheduleSlotDuration] = useState(5);
  const [waitlistScheduleCustomDuration, setWaitlistScheduleCustomDuration] = useState('');
  const [schedulingWaitlist, setSchedulingWaitlist] = useState(false);
  const [waitlistScheduleError, setWaitlistScheduleError] = useState('');

  // Waitlist candidates state (keyed by checkup_id)
  const [waitlistCandidates, setWaitlistCandidates] = useState<Record<string, any[]>>({});
  const [waitlistCandidateFilters, setWaitlistCandidateFilters] = useState<Record<string, string>>({});
  const [addingToWaitlist, setAddingToWaitlist] = useState<Record<string, boolean>>({});
  const [addingAllToWaitlist, setAddingAllToWaitlist] = useState<Record<string, boolean>>({});
  const [deletingWaitlist, setDeletingWaitlist] = useState<Record<string, boolean>>({});

  // Waitlist state
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistCheckup, setWaitlistCheckup] = useState<any>(null);
  const [missedStudents, setMissedStudents] = useState<any[]>([]);
  const [waitlistStartTime, setWaitlistStartTime] = useState('');
  const [waitlistDuration, setWaitlistDuration] = useState(5);
  const [waitlistCustomDuration, setWaitlistCustomDuration] = useState('');
  const [creatingWaitlist, setCreatingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');

  useEffect(() => {
    fetchCheckups();
    fetchTasks();

    const adminSub = supabase
      .channel('admin-checkup-tasks')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff_tasks' }, () => {
        fetchCheckups();
        fetchTasks();
      })
      // Re-fetch when any checkup slot is booked/cancelled so count stays live
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkup_slots' }, () => {
        fetchCheckups();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkup_slots' }, () => {
        fetchCheckups();
      })
      .subscribe();

    return () => { supabase.removeChannel(adminSub); };
  }, []);

  const fetchCheckups = async () => {
    try {
      // Use upcoming view — not month-limited, shows all future/today checkups
      const { data: viewData, error: viewError } = await supabase
        .from('routine_checkup_events_upcoming')
        .select('*')
        .order('date', { ascending: false });

      if (!viewError) {
        // View returns summary rows — also fetch slot details for each checkup
        const ids = (viewData || []).map((c: any) => c.id);
        if (ids.length > 0) {
          const { data: slotsData } = await supabase
            .from('checkup_slots')
            .select('id, time_slot, is_booked, is_cancelled, room_number, cancelled_room_number, booked_by, student_name, completed_at, checkup_id')
            .in('checkup_id', ids);

          const slotsByCheckup: Record<string, any[]> = {};
          (slotsData || []).forEach((s: any) => {
            if (!slotsByCheckup[s.checkup_id]) slotsByCheckup[s.checkup_id] = [];
            slotsByCheckup[s.checkup_id].push(s);
          });

          setCheckups((viewData || []).map((c: any) => ({
            ...c,
            checkup_slots: slotsByCheckup[c.id] || [],
          })));
        } else {
          setCheckups([]);
        }
        setLoading(false);
        return;
      }

      // Fallback to direct table query if view doesn't exist yet
      const { data, error } = await supabase
        .from('routine_checkups')
        .select(`*, checkup_slots (id, time_slot, is_booked, is_cancelled, room_number, booked_by, student_name, completed_at)`)
        .order('date', { ascending: false });

      if (error) throw error;
      setCheckups(data || []);
    } catch (error) {
      console.error('Error fetching checkups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_tasks')
        .select('checkup_id, status, title, description')
        .eq('staff_type', 'routine_checkup');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const getSlotStatus = (checkupId: string) => {
    const task = tasks.find((t: any) => t.checkup_id === checkupId);
    if (!task) return 'awaiting';
    return task.status;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Pending</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">In Progress</span>;
      case 'completed':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">Completed</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">Awaiting Staff</span>;
    }
  };

  const effectiveDuration = slotDuration === -1 ? parseInt(customDuration) || 5 : slotDuration;
  const effectiveNumSlots = numSlots === -1 ? parseInt(customNumSlots) || 32 : numSlots;
  const effectiveWaitlistDuration = waitlistDuration === -1 ? parseInt(waitlistCustomDuration) || 5 : waitlistDuration;

  const getPreview = (dur: number, start: string, slots: number) => {
    if (!start || !dur) return null;
    const totalMins = dur * slots;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const endTime = addMinutes(start, totalMins);
    return `${dur} min × ${slots} rooms = ${hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''} ` : ''}${mins > 0 ? `${mins} min` : ''} — slots from ${start} to ${endTime}`;
  };

  const getWaitlistPreview = (dur: number, start: string, count: number) => {
    if (!start || !dur || !count) return null;
    const totalMins = dur * count;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const endTime = addMinutes(start, totalMins);
    return `${count} missed rooms × ${dur} min = ${hours > 0 ? `${hours} hr ` : ''}${mins} min — slots from ${start} to ${endTime}`;
  };

  const handleCreateCheckup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      if (!hostel || !floor || !date || !startTime) {
        throw new Error('Please fill in all fields');
      }

      const dur = effectiveDuration;
      if (!dur || dur < 1) throw new Error('Please enter a valid slot duration');
      const slots = effectiveNumSlots;
      if (!slots || slots < 1) throw new Error('Please enter a valid number of slots');

      const totalMins = dur * slots;
      const endTime = addMinutes(startTime, totalMins);
      const timeWindow = `${startTime} – ${endTime} (${Math.floor(totalMins / 60)}h ${totalMins % 60}m)`;

      const { data: checkup, error: checkupError } = await supabase
        .from('routine_checkups')
        .insert({
          hostel,
          floor,
          date,
          start_time: startTime,
          time_window: timeWindow,
          slot_duration: dur,
          service_type: 'maintenance',
          created_by: session.user.id,
        })
        .select()
        .single();

      if (checkupError) throw checkupError;

      // Generate slots — must call the 4-argument version so p_slot_count is honoured
      const { error: slotsError } = await supabase.rpc('generate_checkup_slots_custom', {
        p_checkup_id: checkup.id,
        p_start_time: startTime,
        p_slot_duration: dur,
        p_slot_count: slots,
      });

      if (slotsError) throw new Error('Failed to generate slots: ' + slotsError.message);

      // Notify students on that floor
      const { data: students } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'student')
        .eq('hostel', hostel)
        .eq('floor', floor);

      if (students && students.length > 0) {
        const notifications = students.map(student => ({
          user_id: student.id,
          type: 'checkup_scheduled',
          message: `Routine maintenance checkup scheduled on ${date} starting ${startTime} for ${hostel} Floor ${floor}. Please book your ${dur}-minute slot now.`,
          read: false,
          checkup_id: checkup.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      if (logAdminAction) {
        await logAdminAction(
          'create_checkup',
          `Routine checkup created — Floor ${floor}, Date ${date}, ${dur} min × ${slots} slots = ${dur * slots} mins`
        );
      }

      alert('Routine checkup created! Students have been notified.');
      setShowCreateForm(false);
      setFloor('');
      setDate('');
      setStartTime('');
      setSlotDuration(5);
      setCustomDuration('');
      setNumSlots(32);
      setCustomNumSlots('');
      fetchCheckups();
    } catch (err: any) {
      setError(err.message || 'Failed to create checkup');
    } finally {
      setCreating(false);
    }
  };

  const effectiveScheduleSlotDuration = waitlistScheduleSlotDuration === -1
    ? parseInt(waitlistScheduleCustomDuration) || 5
    : waitlistScheduleSlotDuration;

  const handleScheduleWaitlistSession = async () => {
    if (!waitlistScheduleDate || !waitlistScheduleStartTime) {
      setWaitlistScheduleError('Please fill in date and start time');
      return;
    }
    const dur = effectiveScheduleSlotDuration;
    if (!dur || dur < 1) {
      setWaitlistScheduleError('Please enter a valid slot duration');
      return;
    }
    setSchedulingWaitlist(true);
    setWaitlistScheduleError('');
    try {
      const { data, error } = await supabase.rpc('admin_schedule_waitlist_session', {
        p_hostel: waitlistScheduleCheckup.hostel,
        p_floor: waitlistScheduleCheckup.floor,
        p_date: waitlistScheduleDate,
        p_start_time: waitlistScheduleStartTime,
        p_slot_duration: dur,
        p_admin_id: session.user.id,
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? 'Failed to schedule session');
      const count = data?.students_notified ?? 0;
      alert(`Session created, ${count} student${count !== 1 ? 's' : ''} notified.`);
      setShowWaitlistScheduleForm(false);
      setWaitlistScheduleCheckup(null);
      fetchWaitlistCandidates(waitlistScheduleCheckup);
      fetchCheckups();
    } catch (err: any) {
      setWaitlistScheduleError(err.message || 'Failed to schedule waitlist session');
    } finally {
      setSchedulingWaitlist(false);
    }
  };

  const fetchWaitlistCandidates = async (checkup: any) => {
    const checkupId = checkup.id;
    try {
      const { data, error } = await supabase
        .from('checkup_waitlist_candidates')
        .select('*')
        .eq('checkup_id', checkupId);
      if (error) throw error;
      setWaitlistCandidates(prev => ({ ...prev, [checkupId]: data || [] }));
    } catch (err: any) {
      console.error('Failed to fetch waitlist candidates:', err.message);
      setWaitlistCandidates(prev => ({ ...prev, [checkupId]: [] }));
    }
  };

  const handleAddToWaitlist = async (checkup: any, candidate: any) => {
    const key = `${checkup.id}-${candidate.student_id}`;
    setAddingToWaitlist(prev => ({ ...prev, [key]: true }));
    try {
      const { data, error } = await supabase.rpc('add_to_checkup_waitlist', {
        p_checkup_id: candidate.checkup_id,
        p_student_id: candidate.student_id,
        p_room_number: candidate.room_number,
        p_floor: candidate.floor,
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? 'Failed to add to waitlist');
      await fetchWaitlistCandidates(checkup);
    } catch (err: any) {
      alert('Failed to add to waitlist: ' + err.message);
    } finally {
      setAddingToWaitlist(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAddAllToWaitlist = async (checkup: any, filtered: any[]) => {
    if (filtered.length === 0) return;
    setAddingAllToWaitlist(prev => ({ ...prev, [checkup.id]: true }));
    try {
      const candidates = filtered.map((c: any) => ({
        checkup_id: c.checkup_id,
        student_id: c.student_id,
        room_number: c.room_number,
        floor: c.floor,
      }));
      const { data, error } = await supabase.rpc('add_all_to_checkup_waitlist', {
        p_candidates: candidates,
      });
      if (error) throw error;
      const count = data?.processed ?? filtered.length;
      alert(`${count} student${count !== 1 ? 's' : ''} added to waitlist.`);
      await fetchWaitlistCandidates(checkup);
    } catch (err: any) {
      alert('Failed to add all to waitlist: ' + err.message);
    } finally {
      setAddingAllToWaitlist(prev => ({ ...prev, [checkup.id]: false }));
    }
  };

  const handleDeleteWaitlist = async (checkup: any) => {
    if (!confirm(`Delete all waitlist entries for this event (${checkup.date})? This cannot be undone.`)) return;
    setDeletingWaitlist(prev => ({ ...prev, [checkup.id]: true }));
    try {
      const { data, error } = await supabase.rpc('clear_waitlist', {
        p_checkup_id: checkup.id,
      });
      if (error) throw error;
      const count = data?.deleted ?? 0;
      alert(`${count} entr${count !== 1 ? 'ies' : 'y'} removed.`);
      await fetchWaitlistCandidates(checkup);
    } catch (err: any) {
      alert('Failed to delete waitlist: ' + err.message);
    } finally {
      setDeletingWaitlist(prev => ({ ...prev, [checkup.id]: false }));
    }
  };

  const openCancelForm = (checkup: any) => {
    setCancelCheckup(checkup);
    setCancelStartTime(checkup.start_time || '');
    setCancelEndTime('');
    setCancelError('');
    setShowCancelForm(true);
  };

  const handleCancelSlots = async () => {
    if (!cancelCheckup) return;
    setCancelling(true);
    setCancelError('');
    try {
      const { data, error } = await supabase.rpc('admin_cancel_checkup_event', {
        p_checkup_id: cancelCheckup.id,
        p_admin_id: session.user.id,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error ?? 'Failed to cancel event');

      if (logAdminAction) {
        await logAdminAction(
          'checkup_event_cancelled',
          `Checkup event cancelled — ${cancelCheckup.hostel} Floor ${cancelCheckup.floor}, Date ${cancelCheckup.date}`
        );
      }

      alert('Checkup event cancelled and affected students notified.');
      setShowCancelForm(false);
      setCancelCheckup(null);
      fetchCheckups();
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel checkup event');
    } finally {
      setCancelling(false);
    }
  };

  const openWaitlistForm = async (checkup: any) => {
    try {
      const bookedIds = (checkup.checkup_slots || [])
        .filter((s: any) => s.is_booked && !s.is_cancelled)
        .map((s: any) => s.booked_by)
        .filter(Boolean);

      const { data: allStudents } = await supabase
        .from('users')
        .select('id, name, room_number, floor')
        .eq('role', 'student')
        .eq('hostel', checkup.hostel)
        .eq('floor', checkup.floor);

      const missed = (allStudents || [])
        .filter((s: any) => !bookedIds.includes(s.id))
        .sort((a: any, b: any) => {
          const floorDiff = parseInt(a.floor) - parseInt(b.floor);
          if (floorDiff !== 0) return floorDiff;
          return parseInt(a.room_number) - parseInt(b.room_number);
        });

      setMissedStudents(missed);
      setWaitlistCheckup(checkup);
      setWaitlistStartTime('');
      setWaitlistDuration(5);
      setWaitlistCustomDuration('');
      setWaitlistError('');
      setShowWaitlistForm(true);
    } catch (err: any) {
      alert('Failed to load missed students: ' + err.message);
    }
  };

  const handleCreateWaitlist = async () => {
    if (!waitlistStartTime) {
      setWaitlistError('Please enter a start time');
      return;
    }
    const dur = effectiveWaitlistDuration;
    if (!dur || dur < 1) {
      setWaitlistError('Please enter a valid duration');
      return;
    }
    if (missedStudents.length === 0) {
      setWaitlistError('No missed students to assign');
      return;
    }

    setCreatingWaitlist(true);
    setWaitlistError('');
    try {
      for (let i = 0; i < missedStudents.length; i++) {
        const student = missedStudents[i];
        const slotTime = addMinutes(waitlistStartTime, i * dur);

        await supabase.from('checkup_slots').insert({
          checkup_id: waitlistCheckup.id,
          time_slot: slotTime,
          is_booked: true,
          booked_by: student.id,
          room_number: student.room_number,
          student_name: student.name,
        });

        await supabase.from('notifications').insert({
          user_id: student.id,
          type: 'waitlist_assigned',
          message: `You have been assigned a routine checkup slot on ${waitlistCheckup.date} at ${slotTime}. No action needed.`,
          read: false,
        });
      }

      if (logAdminAction) {
        await logAdminAction(
          'create_waitlist',
          `Waitlist session created — ${missedStudents.length} rooms, ${dur} min/slot, starts ${waitlistStartTime}`
        );
      }

      alert(`Waitlist created! ${missedStudents.length} students assigned and notified.`);
      setShowWaitlistForm(false);
      setWaitlistCheckup(null);
      setMissedStudents([]);
      fetchCheckups();
    } catch (err: any) {
      setWaitlistError(err.message || 'Failed to create waitlist');
    } finally {
      setCreatingWaitlist(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading checkups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Routine Maintenance Checkups</h2>
          <p className="text-sm text-gray-600 mt-1">
            Schedule floor-level maintenance checkups with custom slot durations.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-lg hover:from-sky-700 hover:to-sky-800 transition-all shadow-lg shadow-sky-200"
        >
          <Plus className="w-5 h-5" />
          Schedule Checkup
        </button>
      </div>

      {/* Checkups List */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-sky-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Scheduled Checkups</h3>
        {checkups.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No routine checkups scheduled</p>
        ) : (
          <div className="space-y-3">
            {checkups.map((checkup: any) => {
              const slots = checkup.checkup_slots || [];
              const bookedSlots = slots.filter((s: any) => s.is_booked && !s.is_cancelled);
              const cancelledSlots = slots.filter((s: any) => s.is_cancelled);
              // Prefer view's pre-aggregated columns; fall back to client count
              const displayBooked = checkup.booked_slots ?? bookedSlots.length;
              const displayTotal = checkup.total_slots ?? slots.length;
              const totalSlots = slots.length;
              const isExpanded = expandedCheckup === checkup.id;

              return (
                <div key={checkup.id} className="border border-gray-200 rounded-lg overflow-hidden hover:border-sky-300 transition-colors">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => {
                      const next = isExpanded ? null : checkup.id;
                      setExpandedCheckup(next);
                      if (next && !waitlistCandidates[next]) fetchWaitlistCandidates(checkup);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Wrench className="w-5 h-5 text-orange-600" />
                          <h4 className="font-medium text-gray-900">Maintenance Checkup</h4>
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            {displayBooked}/{displayTotal} slots booked
                          </span>
                          {cancelledSlots.length > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                              {cancelledSlots.length} cancelled
                            </span>
                          )}
                          {checkup.slot_duration && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                              {checkup.slot_duration} min/slot
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Hostel {checkup.hostel}
                          </div>
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Floor {checkup.floor}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {checkup.date}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {checkup.time_window}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); openCancelForm(checkup); }}
                          className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" />
                          Cancel Slots
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openWaitlistForm(checkup); }}
                          className="px-3 py-1.5 text-xs border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" />
                          Waitlist
                        </button>
                        <span className="text-sky-600 text-sm font-medium">
                          {isExpanded ? 'Hide' : 'View Slots'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      {bookedSlots.length > 0 ? (
                        <>
                          <h5 className="font-medium text-gray-900 mb-3 text-sm">Booked Slots ({bookedSlots.length})</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {bookedSlots.map((slot: any) => {
                              const status = getSlotStatus(checkup.id);
                              return (
                                <div key={slot.id} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div>
                                      <span className="text-gray-500">Student:</span>{' '}
                                      <span className="font-medium text-gray-900">{slot.student_name || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Room:</span>{' '}
                                      <span className="font-medium text-gray-900">{slot.room_number || 'N/A'}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Time:</span>{' '}
                                      <span className="font-medium text-gray-900">{slot.time_slot}</span>
                                    </div>
                                    <div>{getStatusBadge(slot.completed_at ? 'completed' : status)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No slots booked yet</p>
                      )}

                      {cancelledSlots.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium text-red-700 mb-2 text-sm">Cancelled Slots ({cancelledSlots.length})</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {cancelledSlots.map((slot: any) => (
                              <div key={slot.id} className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                                {slot.time_slot} — Room {slot.cancelled_room_number || slot.room_number || 'N/A'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Waitlist Candidates */}
                      {(() => {
                        const candidates = waitlistCandidates[checkup.id];
                        const filter = waitlistCandidateFilters[checkup.id] ?? 'all';
                        const filtered = candidates
                          ? candidates.filter((c: any) => filter === 'all' || c.reason === filter)
                          : null;

                        return (
                          <div className="mt-5 border-t border-gray-200 pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                Waitlist Candidates
                                {candidates && (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                    {candidates.length}
                                  </span>
                                )}
                              </h5>
                              <div className="flex items-center gap-2">
                                <select
                                  value={filter}
                                  onChange={(e) => setWaitlistCandidateFilters(prev => ({ ...prev, [checkup.id]: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                >
                                  <option value="all">All</option>
                                  <option value="Door Not Opened">Door Not Opened</option>
                                  <option value="Never Booked">Never Booked</option>
                                  <option value="Cancelled - Not Rebooked">Cancelled - Not Rebooked</option>
                                </select>
                                <button
                                  onClick={(e) => { e.stopPropagation(); fetchWaitlistCandidates(checkup); }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1.5 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                                >
                                  Refresh
                                </button>
                                {filtered && filtered.length > 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleAddAllToWaitlist(checkup, filtered); }}
                                    disabled={addingAllToWaitlist[checkup.id]}
                                    className="text-xs text-white font-medium px-2 py-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {addingAllToWaitlist[checkup.id] ? 'Adding...' : `Add All (${filtered.length})`}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteWaitlist(checkup); }}
                                  disabled={deletingWaitlist[checkup.id]}
                                  className="text-xs text-white font-medium px-2 py-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {deletingWaitlist[checkup.id] ? 'Deleting...' : 'Delete Waitlist'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWaitlistScheduleCheckup(checkup);
                                    setWaitlistScheduleDate('');
                                    setWaitlistScheduleStartTime('');
                                    setWaitlistScheduleSlotDuration(5);
                                    setWaitlistScheduleCustomDuration('');
                                    setWaitlistScheduleError('');
                                    setShowWaitlistScheduleForm(true);
                                  }}
                                  className="text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1.5 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                  Schedule Session
                                </button>
                              </div>
                            </div>

                            {candidates === undefined ? (
                              <p className="text-xs text-gray-400 text-center py-3">Loading candidates...</p>
                            ) : filtered!.length === 0 ? (
                              <p className="text-xs text-gray-500 text-center py-3">
                                {filter === 'all' ? 'No waitlist candidates for this event.' : `No "${filter}" candidates.`}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {filtered!.map((candidate: any) => {
                                  const key = `${checkup.id}-${candidate.student_id}`;
                                  const isAdding = addingToWaitlist[key];
                                  const isDoorNotOpened = candidate.reason === 'Door Not Opened';
                                  return (
                                    <div
                                      key={candidate.student_id}
                                      className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{candidate.student_name}</p>
                                          <p className="text-xs text-gray-500">Room {candidate.room_number}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                          isDoorNotOpened
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {candidate.reason}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleAddToWaitlist(checkup, candidate)}
                                        disabled={isAdding}
                                        className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                      >
                                        {isAdding ? 'Adding...' : 'Add to Waitlist'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Checkup Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8">
            <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">Schedule Routine Checkup</h3>
                  <p className="text-sky-100 mt-1">Creates slots across a configurable time window</p>
                </div>
                <button onClick={() => setShowCreateForm(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateCheckup} className="p-6 space-y-5">
              <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <Wrench className="w-6 h-6 text-orange-600" />
                <div>
                  <p className="font-medium text-gray-900">Maintenance</p>
                  <p className="text-xs text-gray-500">Routine checkups are maintenance service only</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hostel</label>
                  <select
                    value={hostel}
                    onChange={(e) => setHostel(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                    required
                  >
                    <option value="H1">H1</option>
                    <option value="H2">H2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                    placeholder="e.g., 3"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time (24h)</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              {/* Slot Duration Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Per Slot</label>
                <div className="flex gap-2 flex-wrap">
                  {[3, 5, 7, 10].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setSlotDuration(d); setCustomDuration(''); }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        slotDuration === d ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-200 hover:border-sky-300'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSlotDuration(-1)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      slotDuration === -1 ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-200 hover:border-sky-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {slotDuration === -1 && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                      placeholder="Minutes"
                    />
                  </div>
                )}
              </div>

              {/* Number of Slots */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Slots</label>
                <div className="flex gap-2 flex-wrap">
                  {[16, 24, 32, 40].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setNumSlots(n); setCustomNumSlots(''); }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        numSlots === n ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-200 hover:border-sky-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNumSlots(-1)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      numSlots === -1 ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-200 hover:border-sky-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {numSlots === -1 && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={customNumSlots}
                      onChange={(e) => setCustomNumSlots(e.target.value)}
                      className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                      placeholder="Count"
                    />
                  </div>
                )}
              </div>

              {/* Live Preview */}
              {startTime && effectiveDuration > 0 && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-900">
                  <strong>Preview:</strong> {getPreview(effectiveDuration, startTime, effectiveNumSlots)}
                  <br />
                  <span className="text-sky-700">
                    Students on <strong>{hostel}</strong> Floor <strong>{floor || '?'}</strong> will be notified.
                  </span>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-lg hover:from-sky-700 hover:to-sky-800 transition-all shadow-lg shadow-sky-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {creating ? 'Creating...' : 'Schedule Checkup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Slots Modal */}
      {showCancelForm && cancelCheckup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Cancel Checkup Slots</h3>
                  <p className="text-red-100 mt-1">
                    {cancelCheckup.hostel} Floor {cancelCheckup.floor} — {cancelCheckup.date}
                  </p>
                </div>
                <button onClick={() => setShowCancelForm(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                This will cancel <strong>all slots</strong> in this checkup event and notify any students who had booked. This cannot be undone.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <strong>Event:</strong> {cancelCheckup.hostel} Floor {cancelCheckup.floor} — {cancelCheckup.date}
              </div>

              {cancelError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {cancelError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCancelForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleCancelSlots}
                  disabled={cancelling}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Entire Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Waitlist Session Modal */}
      {showWaitlistScheduleForm && waitlistScheduleCheckup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-8">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Schedule Waitlist Session</h3>
                  <p className="text-green-100 mt-1">
                    {waitlistScheduleCheckup.hostel} Floor {waitlistScheduleCheckup.floor}
                  </p>
                </div>
                <button onClick={() => setShowWaitlistScheduleForm(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                Creates a new checkup event sized to the number of students currently on the waitlist for this hostel/floor. Each waitlisted student is notified individually to book.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={waitlistScheduleDate}
                    onChange={(e) => setWaitlistScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time (24h)</label>
                  <input
                    type="time"
                    value={waitlistScheduleStartTime}
                    onChange={(e) => setWaitlistScheduleStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Per Slot</label>
                <div className="flex gap-2 flex-wrap">
                  {[3, 5, 7, 10].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setWaitlistScheduleSlotDuration(d); setWaitlistScheduleCustomDuration(''); }}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        waitlistScheduleSlotDuration === d
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWaitlistScheduleSlotDuration(-1)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      waitlistScheduleSlotDuration === -1
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {waitlistScheduleSlotDuration === -1 && (
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={waitlistScheduleCustomDuration}
                    onChange={(e) => setWaitlistScheduleCustomDuration(e.target.value)}
                    className="mt-2 w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Minutes"
                  />
                )}
              </div>

              {waitlistScheduleError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {waitlistScheduleError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowWaitlistScheduleForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleWaitlistSession}
                  disabled={schedulingWaitlist}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {schedulingWaitlist ? 'Scheduling...' : 'Schedule Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Waitlist Modal */}
      {showWaitlistForm && waitlistCheckup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl my-8">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Create Waitlist Session</h3>
                  <p className="text-purple-100 mt-1">
                    {waitlistCheckup.hostel} Floor {waitlistCheckup.floor} — {waitlistCheckup.date}
                  </p>
                </div>
                <button onClick={() => setShowWaitlistForm(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {missedStudents.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">All students on this floor have already booked a slot.</p>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm text-purple-800 font-medium">{missedStudents.length} missed rooms</p>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {missedStudents.map((s: any) => (
                        <span key={s.id} className="text-xs bg-white border border-purple-200 rounded px-2 py-1 text-purple-700">
                          Room {s.room_number}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Waitlist Start Time</label>
                    <input
                      type="time"
                      value={waitlistStartTime}
                      onChange={(e) => setWaitlistStartTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time Per Slot</label>
                    <div className="flex gap-2 flex-wrap">
                      {[3, 5, 7, 10].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => { setWaitlistDuration(d); setWaitlistCustomDuration(''); }}
                          className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                            waitlistDuration === d ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {d} min
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWaitlistDuration(-1)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                          waitlistDuration === -1 ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {waitlistDuration === -1 && (
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={waitlistCustomDuration}
                        onChange={(e) => setWaitlistCustomDuration(e.target.value)}
                        className="mt-2 w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Minutes"
                      />
                    )}
                  </div>

                  {waitlistStartTime && effectiveWaitlistDuration > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-900">
                      <strong>Preview:</strong> {getWaitlistPreview(effectiveWaitlistDuration, waitlistStartTime, missedStudents.length)}
                    </div>
                  )}

                  {waitlistError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {waitlistError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowWaitlistForm(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateWaitlist}
                      disabled={creatingWaitlist}
                      className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {creatingWaitlist ? 'Creating...' : 'Create Waitlist'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
