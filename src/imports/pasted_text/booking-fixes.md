Fix all of the following. Do not rebuild from scratch.
1. Staff cannot complete task — "completed_at column not found"
The completed_at column was missing from the bookings table and has now been added to the database. Replace ALL task completion logic with a call to the RPC function complete_task:
js// When staff presses "End Task"
const { data, error } = await supabase.rpc('complete_task', {
  p_booking_id: task.id,  // or task.booking_id if from staff_tasks
  p_staff_id:   currentUser.id
})
if (error || !data?.success) {
  setError(data?.error ?? 'Failed to complete task')
  return
}
// Refresh task list
Task flow with ONE button per card:

pending → "Start Task" → sets status = 'in_progress' directly via update:

jsawait supabase.from('bookings').update({ status: 'in_progress' }).eq('id', task.id)

in_progress → "End Task" → calls complete_task RPC above
completed → shows "Completed ✓" badge, no button

Remove the "Door Not Opened" button entirely from all staff dashboards.
2. Maintenance bookings — no weekly credit limit
Maintenance bookings must NOT be counted against the student's weekly booking credit. Only housekeeping and emergency bookings use the weekly credit. Fix the booking form:
js// Show weekly credit counter only for housekeeping
if (serviceType === 'housekeeping' || isEmergency) {
  // check weekly_booking_count, block if >= 1
} else {
  // maintenance: always allow, no credit check
}
The create_booking RPC already handles this correctly server-side. Make sure the frontend validation also reflects this — do not block maintenance bookings based on weekly_booking_count.
3. Admin cancel booking — credit returned correctly
Replace the cancel button logic with:
jsconst { data, error } = await supabase.rpc('admin_cancel_booking', {
  p_booking_id: booking.id,
  p_admin_id:   currentUser.id
})
if (data?.success) {
  // refresh all booking lists immediately
  await fetchBookings()
}
Credit is returned automatically for housekeeping and emergency. No credit for maintenance. Student gets a notification automatically.
4. Student cancel booking — credit returned + admin notified
Replace student cancel logic with:
jsconst { data, error } = await supabase.rpc('student_cancel_booking', {
  p_booking_id: booking.id,
  p_user_id:    currentUser.id
})
if (data?.success) {
  // refresh student upcoming bookings
  await fetchUpcomingBookings()
}
After cancel, the booking must immediately disappear from the student's upcoming list and appear in admin cancelled list.
5. Completed bookings counter — weekly, all types
Replace the completed bookings stats with a call to get_weekly_completed_stats:
jsconst { data: stats } = await supabase.rpc('get_weekly_completed_stats')

// Display:
// stats.total          — all completed this week
// stats.housekeeping   — housekeeping completed
// stats.maintenance    — maintenance completed
// stats.emergency      — emergency completed
// stats.routine_checkup — routine checkup completed
// stats.week_start / stats.week_end — date range label
Show in admin and staff dashboards as:

"Completed This Week: {stats.total}"
Breakdown: Housekeeping: {stats.housekeeping} | Maintenance: {stats.maintenance} | Emergency: {stats.emergency} | Checkup: {stats.routine_checkup}

6. Routine checkup staff dashboard — show bookings
The routine checkup staff dashboard is empty because it queries staff_tasks but tasks only exist after a student books a slot. Fix the dashboard to show BOTH:
Pending/in-progress tasks from staff_tasks:
jsconst { data: tasks } = await supabase
  .from('staff_tasks')
  .select('*')
  .eq('staff_type', 'routine_checkup')
  .eq('assigned_to', currentUser.id)
  .order('created_at', { ascending: true })
AND upcoming checkups (so staff can see what's scheduled even before slots are booked):
jsconst { data: checkups } = await supabase
  .from('routine_checkups')
  .select(`*, checkup_slots(id, time_slot, is_booked, room_number, student_name, hostel, floor)`)
  .order('date', { ascending: true })
Show each checkup with all its booked slots as task cards.
7. Admin panel — completed bookings list
The completed bookings section must show ALL completed bookings regardless of date, ordered by most recently completed:
jsconst { data: completed } = await supabase
  .from('bookings')
  .select('*')
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
Columns: Student Name, Room Number, Hostel, Floor, Service Type, Date, Time Slot, Completed At.
8. Admin panel — routine checkup tab shows room numbers and details
In the routine checkup tab, when displaying booked slots show all details:
jsconst { data: checkups } = await supabase
  .from('routine_checkups')
  .select(`
    id, hostel, floor, date, start_time, time_window,
    checkup_slots (
      id, time_slot, is_booked,
      room_number, student_name, hostel, floor, booked_by
    )
  `)
  .order('date', { ascending: false })
For each checkup display:

Checkup header: Hostel, Floor, Date, Start Time, X/32 slots booked
Each booked slot row: Student Name, Room Number, Time Slot, Status

9. Photos — staff and admin can view student uploaded photos
The photos column on bookings is a TEXT[] array of photo URLs. Display them in task cards for staff and in booking detail view for admin:
In staff task card:
js{booking.photos && booking.photos.length > 0 && (
  <div className="photo-grid">
    {booking.photos.map((url, i) => (
      <img
        key={i}
        src={url}
        alt={`Photo ${i + 1}`}
        onClick={() => openPhotoModal(url)}
        style={{ width: 80, height: 80, objectFit: 'cover', cursor: 'pointer' }}
      />
    ))}
  </div>
)}
In admin booking detail:
js{booking.photos?.map((url, i) => (
  <img key={i} src={url} alt={`Evidence ${i+1}`}
    style={{ maxWidth: '100%', borderRadius: 8 }} />
))}
Make sure the booking form upload stores photo URLs in the photos array field, not a separate field. If photos are uploaded to Supabase Storage, store the public URLs in bookings.photos.
10. Admin panel upcoming bookings — exclude routine checkup
The Upcoming Bookings list in admin must only show regular bookings (housekeeping, maintenance, emergency). Routine checkup tasks belong only in the Routine Checkup tab:
jsconst { data: upcoming } = await supabase
  .from('bookings')
  .select('*')
  .in('status', ['pending', 'in_progress'])
  .order('date', { ascending: true })
// bookings table only has housekeeping/maintenance/emergency
// routine checkup is in checkup_slots — already separate