Make ONLY this one fix. Do not change anything else.
The problem
When routine checkup staff completes a task, it shows completed in the staff dashboard and admin panel but the student dashboard still shows the slot as pending. The realtime subscription fires but the student dashboard re-fetches stale data because it loops through slots and checks each task individually — this is slow and unreliable.
The fix — two parts
Part 1: Update complete_checkup_task to write completion directly onto the checkup_slot row
In the Supabase SQL Editor, run this to update the complete_checkup_task function so it stamps completed_at directly on the checkup_slots row when the task is finished:
sqlCREATE OR REPLACE FUNCTION public.complete_checkup_task(
  p_task_id  UUID,
  p_staff_id UUID
)
RETURNS json AS $$
DECLARE
  v_task RECORD;
  v_slot RECORD;
BEGIN
  SELECT * INTO v_task FROM public.staff_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- Complete the staff task
  UPDATE public.staff_tasks
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_task_id;

  -- Find the booked slot for this checkup and stamp it completed
  SELECT * INTO v_slot
  FROM public.checkup_slots
  WHERE checkup_id = v_task.checkup_id
    AND is_booked = TRUE
    AND is_cancelled = FALSE
  LIMIT 1;

  IF v_slot.id IS NOT NULL THEN
    -- Add completed_at to the slot row so student dashboard can query it directly
    UPDATE public.checkup_slots
    SET completed_at = NOW()
    WHERE id = v_slot.id;

    -- Notify the student
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (
      v_slot.booked_by,
      'checkup_completed',
      'Your routine checkup has been completed.'
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
Also add the completed_at column to checkup_slots if it does not exist:
sqlALTER TABLE public.checkup_slots
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
Part 2: Fix the student dashboard fetch functions to use completed_at on checkup_slots directly
Replace the fetchUpcomingBookings and fetchCompletedBookings functions with these simpler versions that do NOT loop through staff_tasks — they read directly from the checkup_slots row:
jsasync function fetchUpcomingBookings() {
  // Regular bookings — pending and in_progress
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, service_type, date, time_slot, hostel, floor, status, is_emergency, photos, notes')
    .eq('user_id', currentUser.id)
    .in('status', ['pending', 'in_progress'])
    .order('date', { ascending: true })

  // Checkup slots — pending = booked, not cancelled, completed_at is null
  const { data: slots } = await supabase
    .from('checkup_slots')
    .select(`
      id, time_slot, booked_by, completed_at,
      routine_checkups ( id, hostel, floor, date, start_time )
    `)
    .eq('booked_by', currentUser.id)
    .eq('is_booked', true)
    .eq('is_cancelled', false)
    .is('completed_at', null)   // null completed_at = still pending

  const pendingSlots = (slots ?? []).map(slot => ({
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
  }))

  setUpcomingBookings(
    [...(bookings ?? []), ...pendingSlots]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  )
}

async function fetchCompletedBookings() {
  const weekStart = getMonday().toISOString()

  // Regular completed bookings this week
  const { data: completed } = await supabase
    .from('bookings')
    .select('id, service_type, date, time_slot, hostel, floor, status, completed_at, is_emergency')
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')
    .gte('completed_at', weekStart)
    .order('completed_at', { ascending: false })

  // Completed checkup slots this week — completed_at is NOT null
  const { data: completedSlots } = await supabase
    .from('checkup_slots')
    .select(`
      id, time_slot, booked_by, completed_at,
      routine_checkups ( hostel, floor, date )
    `)
    .eq('booked_by', currentUser.id)
    .eq('is_booked', true)
    .eq('is_cancelled', false)
    .not('completed_at', 'is', null)   // completed_at set = task done
    .gte('completed_at', weekStart)

  const completedCheckups = (completedSlots ?? []).map(slot => ({
    id: slot.id,
    service_type: 'Routine Checkup',
    date: slot.routine_checkups?.date,
    time_slot: slot.time_slot,
    hostel: slot.routine_checkups?.hostel,
    floor: slot.routine_checkups?.floor,
    status: 'completed',
    completed_at: slot.completed_at,
    is_checkup: true
  }))

  setCompletedBookings(
    [...(completed ?? []), ...completedCheckups]
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
  )
}
Part 3: Fix the realtime subscription to watch checkup_slots directly
Replace the realtime subscription for checkup tasks in the student dashboard useEffect:
js// Watch checkup_slots for completed_at being set (replaces staff_tasks subscription)
const checkupSub = supabase
  .channel('student-checkup-completion')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'checkup_slots',
    filter: `booked_by=eq.${currentUser.id}`
  }, (payload) => {
    // When completed_at is set on the slot, move it from pending to completed
    if (payload.new.completed_at && !payload.old.completed_at) {
      fetchUpcomingBookings()
      fetchCompletedBookings()
    }
  })
  .subscribe()
This is reliable because it watches the exact row belonging to this student, not all staff_tasks globally.
That is all. Do not change anything else.