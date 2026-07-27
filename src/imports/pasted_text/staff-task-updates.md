Make ONLY the following 4 changes. Do not modify anything else in the app.
1. Door Not Opened button — all staff dashboards
In Housekeeping, Maintenance, and Routine Checkup staff dashboards, on every task card:

Show "Door Not Opened" button ONLY when status = pending
Hide it completely once status changes to in_progress, completed, or cancelled
It sits alongside the "Start Task" button when status is pending
Clicking it calls:

jsconst { data } = await supabase.rpc('report_door_not_opened', {
  p_booking_id: task.booking_id ?? task.id,
  p_staff_id:   currentUser.id
})
if (data?.success) await fetchTasks()
Task card button logic:
status = pending    → show "Start Task" button + "Door Not Opened" button
status = in_progress → show "End Task" button only (no Door Not Opened)
status = completed  → show "Completed ✓" badge only
2. Routine checkup in student dashboard — pending list with cancel and reschedule
In the student dashboard upcoming/pending bookings list, routine checkup slots must appear exactly like regular bookings. Fix the fetch to include checkup slots:
js// Fetch booked checkup slots that are not cancelled
const { data: slots } = await supabase
  .from('checkup_slots')
  .select(`
    id, time_slot, is_booked, booked_by, is_cancelled,
    routine_checkups ( id, hostel, floor, date, start_time )
  `)
  .eq('booked_by', currentUser.id)
  .eq('is_booked', true)
  .eq('is_cancelled', false)
Display each checkup slot as a pending booking card showing:

Service Type: "Routine Checkup"
Date, Time Slot, Hostel, Floor
Status: Pending
A "Cancel Slot" button

When student taps "Cancel Slot":
jsconst { data } = await supabase.rpc('cancel_checkup_slot', {
  p_slot_id:    slot.id,
  p_student_id: currentUser.id
})
if (data?.success) {
  // Remove from pending list
  await fetchUpcomingBookings()
  // Show the checkup slot booking pop-up again so student can pick a new slot
  // Re-fetch available slots for that checkup and open the slot selection modal
  const { data: availableSlots } = await supabase
    .from('checkup_slots')
    .select('*')
    .eq('checkup_id', slot.routine_checkups.id)
    .eq('is_booked', false)
    .eq('is_cancelled', false)
    .order('time_slot', { ascending: true })
  setRescheduleSlots(availableSlots)
  setRescheduleCheckup(slot.routine_checkups)
  setShowRescheduleModal(true)
}
The reschedule modal is the same slot picker used during original booking. On confirming a new slot call book_checkup_slot RPC as before.
3. Admin routine checkup tab — show pending/in-progress/completed status
In the admin Routine Checkup tab, for each booked slot row show a status badge that reflects the current staff task status. Fetch the status from staff_tasks:
jsconst { data: checkups } = await supabase
  .from('routine_checkups')
  .select(`
    id, hostel, floor, date, start_time, time_window,
    checkup_slots (
      id, time_slot, is_booked, is_cancelled,
      room_number, student_name, hostel, floor, booked_by
    )
  `)
  .order('date', { ascending: false })

// For each booked slot, get its task status
const { data: tasks } = await supabase
  .from('staff_tasks')
  .select('checkup_id, status, title, description')
  .eq('staff_type', 'routine_checkup')
Match tasks to slots by checkup_id and show a status badge on each slot row:

Pending → yellow badge "Pending"
In Progress → blue badge "In Progress"
Completed → green badge "Completed"
No task yet → grey badge "Awaiting Staff"

4. Routine checkup completion — update student dashboard and admin tab
When routine checkup staff presses "End Task" and calls complete_checkup_task RPC, make sure both the student dashboard and admin panel update immediately using Supabase realtime:
In student dashboard — subscribe to staff_tasks changes:
jsconst sub = supabase
  .channel('checkup-tasks')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'staff_tasks',
    filter: `staff_type=eq.routine_checkup`
  }, async (payload) => {
    if (payload.new.status === 'completed') {
      // Move the matching checkup slot from pending to completed list
      await fetchUpcomingBookings()
      await fetchCompletedBookings()
    }
  })
  .subscribe()
When a checkup task is completed, the matching slot must:

Disappear from the student's pending/upcoming list
Appear in the student's completed list this week with label "Routine Checkup"

Fetch completed checkup slots for student:
jsconst weekStart = getMonday(new Date()).toISOString()
const { data: completedSlots } = await supabase
  .from('checkup_slots')
  .select(`
    id, time_slot, booked_by,
    routine_checkups ( hostel, floor, date )
  `)
  .eq('booked_by', currentUser.id)
  .eq('is_booked', true)
  .eq('is_cancelled', false)
// Show all booked slots in completed if their staff_task is completed
To check if a slot's task is done:
jsconst { data: taskStatus } = await supabase
  .from('staff_tasks')
  .select('status')
  .eq('checkup_id', slot.routine_checkups.id)
  .eq('staff_type', 'routine_checkup')
  .single()
const isCompleted = taskStatus?.status === 'completed'
In admin Routine Checkup tab — realtime update:
jsconst adminSub = supabase
  .channel('admin-checkup-tasks')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'staff_tasks'
  }, () => fetchCheckups())
  .subscribe()
This ensures when staff completes a task, the status badge in the admin Routine Checkup tab instantly updates from "In Progress" to "Completed" without needing a page refresh.