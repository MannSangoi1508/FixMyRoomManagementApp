Make ONLY the following changes. Do not touch anything else in the app. Everything else is working correctly.
The one problem to fix:
The student dashboard "Completed Bookings" list is not updating when tasks are completed. Tasks stay in the pending list even after staff marks them as done. The list must update in real time and reset every Monday at 12:00am.
Step 1 — Helper function for week start (add once, reuse everywhere)
Add this function at the top of the student dashboard file if it does not already exist:
jsfunction getMonday(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}
Step 2 — Replace the completed bookings fetch function
Find the function that fetches completed bookings on the student dashboard and replace it entirely with this:
jsasync function fetchCompletedBookings() {
  const weekStart = getMonday().toISOString()

  // All completed regular bookings this week (housekeeping, maintenance, emergency)
  const { data: completed } = await supabase
    .from('bookings')
    .select('id, service_type, date, time_slot, hostel, floor, status, completed_at, is_emergency, photos')
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')
    .gte('completed_at', weekStart)
    .order('completed_at', { ascending: false })

  // All completed routine checkup slots this week
  // A checkup slot is "completed" when its matching staff_task has status = 'completed'
  const { data: slots } = await supabase
    .from('checkup_slots')
    .select(`
      id, time_slot, booked_by,
      routine_checkups ( id, hostel, floor, date, start_time )
    `)
    .eq('booked_by', currentUser.id)
    .eq('is_booked', true)
    .eq('is_cancelled', false)

  // For each slot, check if its staff task is completed
  const completedSlots = []
  for (const slot of (slots ?? [])) {
    const { data: task } = await supabase
      .from('staff_tasks')
      .select('status, completed_at')
      .eq('checkup_id', slot.routine_checkups?.id)
      .eq('staff_type', 'routine_checkup')
      .eq('status', 'completed')
      .gte('completed_at', weekStart)
      .single()

    if (task) {
      completedSlots.push({
        id: slot.id,
        service_type: 'Routine Checkup',
        date: slot.routine_checkups?.date,
        time_slot: slot.time_slot,
        hostel: slot.routine_checkups?.hostel,
        floor: slot.routine_checkups?.floor,
        status: 'completed',
        completed_at: task.completed_at,
        is_checkup: true
      })
    }
  }

  // Merge and sort by completed_at descending
  const all = [...(completed ?? []), ...completedSlots]
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  setCompletedBookings(all)
}
Step 3 — Replace the pending bookings fetch to exclude completed tasks
Find the function that fetches pending/upcoming bookings and make sure it excludes anything that is now completed:
jsasync function fetchUpcomingBookings() {
  // Regular bookings — only pending and in_progress
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, service_type, date, time_slot, hostel, floor, status, is_emergency, photos, notes')
    .eq('user_id', currentUser.id)
    .in('status', ['pending', 'in_progress'])
    .order('date', { ascending: true })

  // Checkup slots — only those NOT completed by staff yet
  const { data: slots } = await supabase
    .from('checkup_slots')
    .select(`
      id, time_slot, booked_by,
      routine_checkups ( id, hostel, floor, date, start_time )
    `)
    .eq('booked_by', currentUser.id)
    .eq('is_booked', true)
    .eq('is_cancelled', false)

  // Keep only slots whose staff task is NOT yet completed
  const pendingSlots = []
  for (const slot of (slots ?? [])) {
    const { data: task } = await supabase
      .from('staff_tasks')
      .select('status')
      .eq('checkup_id', slot.routine_checkups?.id)
      .eq('staff_type', 'routine_checkup')
      .maybeSingle()

    const taskDone = task?.status === 'completed'
    if (!taskDone) {
      pendingSlots.push({
        id: slot.id,
        service_type: 'Routine Checkup',
        date: slot.routine_checkups?.date,
        time_slot: slot.time_slot,
        hostel: slot.routine_checkups?.hostel,
        floor: slot.routine_checkups?.floor,
        status: 'pending',
        is_checkup: true,
        checkup_id: slot.routine_checkups?.id,
        slot_id: slot.id
      })
    }
  }

  setUpcomingBookings([...(bookings ?? []), ...pendingSlots]
    .sort((a, b) => new Date(a.date) - new Date(b.date)))
}
Step 4 — Add realtime subscriptions that trigger both fetches
In the student dashboard useEffect, set up realtime subscriptions so both lists update instantly when any task is completed — no manual refresh needed:
jsuseEffect(() => {
  if (!currentUser) return

  // Initial fetch
  fetchUpcomingBookings()
  fetchCompletedBookings()

  // Watch for booking status changes (housekeeping, maintenance, emergency)
  const bookingSub = supabase
    .channel('student-booking-updates')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'bookings',
      filter: `user_id=eq.${currentUser.id}`
    }, () => {
      fetchUpcomingBookings()
      fetchCompletedBookings()
    })
    .subscribe()

  // Watch for routine checkup task completions
  const taskSub = supabase
    .channel('student-checkup-task-updates')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'staff_tasks'
    }, (payload) => {
      if (payload.new.status === 'completed') {
        fetchUpcomingBookings()
        fetchCompletedBookings()
      }
    })
    .subscribe()

  return () => {
    supabase.removeChannel(bookingSub)
    supabase.removeChannel(taskSub)
  }
}, [currentUser])
Step 5 — Display completed list
Make sure the completed bookings section renders from the completedBookings state array. Each card shows:

Service type label (Housekeeping / Maintenance / Emergency / Routine Checkup)
Date and time slot
Hostel and floor
"Completed ✓" green badge

jsx<h3>Completed This Week ({completedBookings.length})</h3>
{completedBookings.length === 0 ? (
  <p>No completed bookings this week</p>
) : (
  completedBookings.map(b => (
    <div key={b.id} className="booking-card completed">
      <span className="badge green">Completed ✓</span>
      <div>{b.is_emergency ? 'Emergency' : b.service_type}</div>
      <div>{b.date} at {b.time_slot}</div>
      <div>{b.hostel} Floor {b.floor}</div>
    </div>
  ))
)}
That is all. Do not change anything else.