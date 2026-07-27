Fix all of the following bugs and add the listed features. Do not rebuild anything from scratch.
1. Supabase client fix — Project ID warning and Network error on booking
Both errors come from the Supabase client not being set up as a singleton. Fix:

Find the Supabase client file (likely src/utils/supabase/client.ts or similar)
Replace the entire contents with:

jsimport { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

Remove any projectId, project_id, or projectRef from the config — these are not valid options
Every component must import supabase from this one file only — remove any createClient() calls inside components

2. Booking insert — service_type and time_slot null fix
The booking insert fails with null service_type and time_slot. Fix:

Add validation before insert — block if either is missing:

jsif (!serviceType || !selectedTimeSlot) {
  setError('Please select a service type and time slot.')
  return
}

The insert object must include ALL these fields:

js{
  user_id: user.id,
  user_name: profile.name,
  room_number: profile.room_number,
  hostel: profile.hostel,
  floor: profile.floor,
  service_type: serviceType,
  date: selectedDate,
  time_slot: selectedTimeSlot,
  notes: notes ?? '',
  is_emergency: false,
  status: 'pending',
  assigned_staff: null,
  assigned_staff_name: 'Pending Assignment'
}

Make sure the service type dropdown onChange calls setServiceType(value) immediately
Make sure the time slot selector calls setSelectedTimeSlot(slot) when tapped

3. Admin dashboard — stat boxes
Rename and fix these two stat boxes:
"Active Bookings for the Day"

Count = bookings where date = today AND status IN ('pending', 'in_progress')
Never include cancelled or completed

jsconst today = new Date().toISOString().split('T')[0]
const { count } = await supabase
  .from('bookings')
  .select('*', { count: 'exact', head: true })
  .eq('date', today)
  .in('status', ['pending', 'in_progress'])
"Completion Rate for the Day"

Call RPC get_daily_completion_rate:

jsconst { data } = await supabase.rpc('get_daily_completion_rate', {
  p_date: new Date().toISOString().split('T')[0]
})

Display as {data.completion_rate}%
Cancelled bookings excluded from all calculations
No-show (door not opened) counts as completed since service was attempted
Resets automatically at start of each day since it always filters by today

4. Admin dashboard — booking lists
Replace the current single booking list with TWO separate lists:
"Upcoming Bookings" list

Shows only bookings where status IN ('pending', 'in_progress') AND date = today
Columns: Student Name, Room Number, Hostel, Floor, Date, Time Slot, Service Type, Status
Query:

jsconst today = new Date().toISOString().split('T')[0]
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('date', today)
  .in('status', ['pending', 'in_progress'])
  .order('time_slot', { ascending: true })
"Completed Bookings" list

Shows only bookings where status = 'completed' AND date = today
Columns: Student Name, Room Number, Hostel, Floor, Date, Time Slot, Service Type
Query:

jsconst { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('date', today)
  .eq('status', 'completed')
  .order('time_slot', { ascending: true })
"Cancelled Bookings" list (separate tab or section)

Shows all cancelled bookings
Query:

jsconst { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('status', 'cancelled')
  .order('date', { ascending: false })
5. Three separate staff dashboards
There are 3 staff types stored in users.staff_type: 'housekeeping', 'maintenance', 'routine_checkup'. After login, route staff to their specific dashboard based on staff_type:
HousekeepingDashboard

Shows ONLY bookings where service_type = 'housekeeping'
Task cards show: student name, room number, hostel, floor, date, time slot, notes
Task flow: pending → Start Task button → in_progress → End Task button → completed
"Door Not Opened" button on each pending/in_progress task

MaintenanceDashboard

Shows ONLY bookings where service_type = 'maintenance'
Same task card layout and flow as housekeeping
"Door Not Opened" button on each pending/in_progress task

RoutineCheckupDashboard

Shows ONLY tasks from staff_tasks where staff_type = 'routine_checkup'
Each task shows: student name, room number, hostel, floor, date, time slot
Same Start Task / End Task flow

Routing logic after login:
jsif (user.role === 'staff') {
  if (user.staff_type === 'housekeeping') navigate('/staff/housekeeping')
  else if (user.staff_type === 'maintenance') navigate('/staff/maintenance')
  else if (user.staff_type === 'routine_checkup') navigate('/staff/routine-checkup')
}
Staff task counter on each dashboard:

Show live counts at top: Pending: X | In Progress: X | Completed: X
Update reactively when status changes
Never remove a task from view when it moves to in_progress — tasks stay visible at all stages

6. Staff task flow fix
Each task card shows ONE button based on current status:

pending → "Start Task" button → sets status to in_progress
in_progress → "End Task" button → sets status to completed, sets completed_at = now()
completed → shows "Completed" label only, no button
Tasks must remain visible in ALL stages. Never hide or remove a task when status changes.

7. Door Not Opened button
On each pending or in_progress task, show a "Door Not Opened" button. When tapped call:
jsconst { data } = await supabase.rpc('report_door_not_opened', {
  p_booking_id: booking.id,
  p_staff_id: currentUser.id
})
if (data?.success) {
  // refresh task list
}
This marks the booking as completed, files the report, and auto-flags the student if it is their 2nd report.
8. Admin cancel/override booking fix
The cancel button must call RPC admin_cancel_booking:
jsconst { data } = await supabase.rpc('admin_cancel_booking', {
  p_booking_id: booking.id,
  p_admin_id: currentUser.id
})
if (data?.success) {
  // refresh booking lists
}
After cancel: booking moves to Cancelled list, disappears from Upcoming list, student gets notification, credit returned if housekeeping.
9. Routine checkup — fix JSON error and full flow
The error "Unexpected non-whitespace character after JSON at position 4" is caused by passing slots as a raw JSON string. Replace the entire checkup creation flow:
Admin creates checkup:

Form fields: Hostel (dropdown: H1, H2 only), Floor, Date, Start Time (24hr input)
Service type is always maintenance — do not show this as a field
On submit:

js// Step 1: Insert checkup record
const { data: checkup, error } = await supabase
  .from('routine_checkups')
  .insert({
    hostel: hostel,
    floor: floor,
    date: date,
    start_time: startTime,
    time_window: startTime + ' onwards (2h 40min)',
    service_type: 'maintenance',
    created_by: currentUser.id
  })
  .select()
  .single()

if (error) throw error

// Step 2: Generate 32 slots via RPC — do NOT pass slots as JSON
await supabase.rpc('generate_checkup_slots', {
  p_checkup_id: checkup.id,
  p_start_time: startTime
})

Do NOT manually build or pass any slot array or JSON object

Notifications to students:
After checkup is created, query all students where hostel = checkup.hostel AND floor = checkup.floor and insert a notification for each:
jsconst { data: students } = await supabase
  .from('users')
  .select('id')
  .eq('role', 'student')
  .eq('hostel', hostel)
  .eq('floor', floor)

for (const student of students) {
  await supabase.from('notifications').insert({
    user_id: student.id,
    type: 'checkup_scheduled',
    message: `Routine maintenance checkup scheduled on ${date} starting ${startTime} for ${hostel} Floor ${floor}. Please book your 5-minute slot now.`
  })
}
Pop-up on student dashboard:

When a student logs in or the dashboard loads, check for unread notifications of type checkup_scheduled
If found, show a modal/pop-up with the message and a "Book Slot" button
"Book Slot" opens the slot selection screen showing all available (is_booked = false) slots for that checkup
Student selects one slot and confirms:

jsawait supabase
  .from('checkup_slots')
  .update({ is_booked: true, booked_by: currentUser.id })
  .eq('id', selectedSlotId)

After booking, insert a task into staff_tasks for the routine checkup staff:

jsawait supabase.from('staff_tasks').insert({
  checkup_id: checkup.id,
  assigned_to: routineCheckupStaffId,
  staff_type: 'routine_checkup',
  title: `Checkup: ${student.name}, Room ${student.room_number}`,
  description: `${hostel} Floor ${floor} on ${date} at ${selectedSlot}`,
  status: 'pending'
})

Mark the notification as read after the student books

Flagging students who don't book:

When admin views the checkup or at checkup start time, show a "Flag Unbooked Students" button that calls:

jsawait supabase.rpc('flag_unbooked_checkup_students', {
  p_checkup_id: checkup.id
})

This flags all students on that floor who did not book a slot and notifies admin

Admin schedule view:

Show all routine checkups in admin schedule/calendar view
Each checkup shows: hostel, floor, date, start time, number of slots booked vs total (e.g. 18/32 booked)

10. Notifications — mark as read

Bell icon shows red bubble with count of read = false notifications
Notifications panel shows all notifications, unread highlighted
Tapping a notification or pressing "Mark as read" sets read = true:

jsawait supabase
  .from('notifications')
  .update({ read: true })
  .eq('id', notification.id)

"Mark all as read" button:

jsawait supabase
  .from('notifications')
  .update({ read: true })
  .eq('user_id', currentUser.id)
  .eq('read', false)

Red bubble disappears when count reaches 0
Use Supabase realtime subscription on notifications table

11. Flagged students — auto reset after 7 days
On admin dashboard load, call:
jsawait supabase.rpc('reset_expired_flags')
Then refresh the flagged students list which shows only flagged = true users with: name, room number, email, flag reason.
12. Hostel values — H1 and H2 only

All hostel dropdowns must have exactly two options: H1 and H2
Never display or store HH1 or HH2
Check every form that has a hostel field and fix the option values

13. Weekly booking counter

Display as {weekly_booking_count}/1 on student dashboard
Read weekly_booking_count from users table for logged-in student
After booking insert, increment: weekly_booking_count = weekly_booking_count + 1
Emergency booking section only visible when weekly_booking_count >= 1
Show message "Use your weekly booking first" when count is 0

14. Emergency slots — hide expired
Filter emergency slots to only show where is_available = true AND slot has not passed:
jsconst now = new Date()
const today = now.toISOString().split('T')[0]
const currentHour = now.getHours()

const { data: slots } = await supabase
  .from('emergency_slots')
  .select('*')
  .eq('is_available', true)
  .gte('date', today)

const validSlots = slots.filter(slot => {
  if (slot.date > today) return true
  const slotHour = parseInt(slot.time_window.split(':')[0])
  return slotHour > currentHour
})