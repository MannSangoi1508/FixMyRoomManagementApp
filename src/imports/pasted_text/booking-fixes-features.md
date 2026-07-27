Fix the following bugs and add the listed features. Do not rebuild from scratch.
1. White screen when pressing "Book a Service" — React crash fix
The error in the <mo> component crashes the entire app. This is caused by the booking form trying to render before user profile data is loaded, causing .split() or similar calls on undefined values. Fix:

Add a loading guard at the top of the booking form component — do not render the form until the user profile is fully loaded:

jsif (!profile || !currentUser) {
  return <div>Loading...</div>
}

Replace the entire booking insert logic with a call to the RPC function create_booking — this handles all validation server-side and never throws a constraint error to the frontend:

jsconst { data, error } = await supabase.rpc('create_booking', {
  p_user_id:      currentUser.id,
  p_user_name:    profile.name,
  p_room_number:  profile.room_number,
  p_hostel:       profile.hostel,
  p_floor:        profile.floor,
  p_service_type: serviceType,
  p_date:         selectedDate,
  p_time_slot:    selectedTimeSlot,
  p_notes:        notes ?? '',
  p_is_emergency: isEmergency
})

if (error || !data?.success) {
  setError(data?.error ?? error?.message ?? 'Booking failed')
  return
}

// Success — navigate to dashboard
navigate('/student/dashboard')

Add null checks before every field that could be undefined in the form:

jsconst serviceType = selectedServiceType ?? ''
const selectedDate = pickedDate ?? ''
const selectedTimeSlot = pickedTimeSlot ?? ''

Emergency bookings are automatically treated as housekeeping — do not show service type selector when isEmergency = true

2. Routine checkup slot booking — assigned_to null fix
The error null value in column "assigned_to" of relation "staff_tasks" violates not-null constraint means no routine checkup staff account exists yet. Replace the entire slot booking logic with a call to the RPC function book_checkup_slot which handles staff assignment gracefully:
jsconst { data, error } = await supabase.rpc('book_checkup_slot', {
  p_slot_id:    selectedSlot.id,
  p_student_id: currentUser.id,
  p_checkup_id: checkup.id
})

if (error || !data?.success) {
  setError(data?.error ?? 'Failed to book slot')
  return
}

// Show confirmation
setSuccess(`Slot confirmed for ${data.date} at ${data.time_slot}`)
// Mark checkup notification as read
await supabase
  .from('notifications')
  .update({ read: true })
  .eq('user_id', currentUser.id)
  .eq('type', 'checkup_scheduled')
// Refresh student upcoming bookings
3. Room lock — one slot per room per checkup
When a student opens the slot booking screen for a checkup, check if their room already has a booked slot:
jsconst { data: existingSlot } = await supabase
  .from('checkup_slots')
  .select('*')
  .eq('checkup_id', checkup.id)
  .eq('room_number', profile.room_number)
  .eq('is_booked', true)
  .single()

if (existingSlot) {
  // Show message instead of slot list
  return <div>A slot has already been booked for Room {profile.room_number}</div>
}
Any student with the same room number who tries to book sees "Already booked for your room" and cannot select a slot.
4. After checkup slot is booked — update all relevant views
After book_checkup_slot succeeds:

Student upcoming bookings: add the checkup slot to the student's upcoming bookings list showing date, time slot, hostel, floor, type: "Routine Checkup"
Routine checkup staff dashboard: the new task appears immediately via Supabase realtime subscription on staff_tasks
Admin panel: show booked checkup slots in the "Routine Checkup" tab only — not in the main bookings dashboard or upcoming bookings list

5. Admin panel — routine checkup in its own tab only
Routine checkup slots must ONLY appear in a dedicated "Routine Checkup" tab in admin dashboard. They must NOT appear in:

Upcoming Bookings list
Completed Bookings list
Cancelled Bookings list

The Routine Checkup tab shows:

Each checkup with: hostel, floor, date, start time, slots booked vs total (e.g. 18/32)
Expandable row showing each booked slot: student name, room number, time slot, status

Query for admin routine checkup tab:
jsconst { data: checkups } = await supabase
  .from('routine_checkups')
  .select(`
    *,
    checkup_slots (
      id, time_slot, is_booked, room_number, student_name, booked_by
    )
  `)
  .order('date', { ascending: false })
6. Emergency bookings = housekeeping
Emergency bookings must always be treated as housekeeping service type:

When is_emergency = true, set service_type = 'housekeeping' automatically
Emergency bookings appear in the Housekeeping staff dashboard only, not maintenance
In housekeeping staff dashboard query, include emergency bookings:

jsconst { data } = await supabase
  .from('bookings')
  .select('*')
  .or('service_type.eq.housekeeping,is_emergency.eq.true')
  .in('status', ['pending', 'in_progress'])
  .order('date', { ascending: true })
7. Staff dashboards — filter options
Add a filter bar at the top of ALL three staff dashboards (housekeeping, maintenance, routine checkup). Filters:
Housekeeping and Maintenance dashboards:

Status filter: All | Pending | In Progress | Completed
Date filter: Today | This Week | All
Hostel filter: All | H1 | H2

Filter logic example:
jslet query = supabase
  .from('bookings')
  .select('*')
  .eq('service_type', 'housekeeping') // or 'maintenance'

if (statusFilter !== 'all') query = query.eq('status', statusFilter)
if (hostelFilter !== 'all') query = query.eq('hostel', hostelFilter)
if (dateFilter === 'today') query = query.eq('date', today)
if (dateFilter === 'week') query = query.gte('date', today).lte('date', weekEnd)

const { data } = await query.order('date', { ascending: true })
Routine Checkup dashboard:

Status filter: All | Pending | In Progress | Completed
Date filter: Today | This Week | All
Hostel filter: All | H1 | H2

Filter logic:
jslet query = supabase
  .from('staff_tasks')
  .select('*')
  .eq('staff_type', 'routine_checkup')
  .eq('assigned_to', currentUser.id)

if (statusFilter !== 'all') query = query.eq('status', statusFilter)

const { data } = await query.order('created_at', { ascending: true })
8. Student upcoming bookings — include checkup slots
The student's upcoming bookings section must show both regular bookings AND booked checkup slots:
Regular bookings:
jsconst { data: regularBookings } = await supabase
  .from('bookings')
  .select('*')
  .eq('user_id', currentUser.id)
  .in('status', ['pending', 'in_progress'])
  .order('date', { ascending: true })
Checkup slots booked by student:
jsconst { data: checkupSlots } = await supabase
  .from('checkup_slots')
  .select(`*, routine_checkups(hostel, floor, date, start_time)`)
  .eq('booked_by', currentUser.id)
  .eq('is_booked', true)
Merge and display both lists together, sorted by date. Show checkup slots with type label "Routine Checkup".
9. Auth fix — AuthSessionMissingError
The AuthSessionMissingError with status 400 is caused by the backend middleware using the service role client to verify user JWTs. Fix the auth middleware:
js// In authMiddleware — use anon client with user Bearer token
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { global: { headers: { Authorization: `Bearer ${token}` } } }
)
const { data: { user } } = await supabase.auth.getUser()
The frontend singleton client must have NO projectId field:
jsexport const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)