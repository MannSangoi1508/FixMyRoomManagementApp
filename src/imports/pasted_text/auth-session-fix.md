Fix all of the following. Do not rebuild from scratch.
1. AuthSessionMissingError — core auth fix
The error AuthSessionMissingError: Auth session missing with status 400 is caused by the backend middleware using getSupabaseClient() (service role) to verify user JWT tokens. The service role client cannot validate user sessions — only the anon client with the user's JWT can do that. Fix:

In src/middleware or wherever authMiddleware is defined, replace getSupabaseClient() with the standard anon client when verifying user sessions:

js// WRONG — service role cannot verify user sessions
const supabase = getSupabaseClient()
const { data: { user } } = await supabase.auth.getUser(token)

// CORRECT — use createClient with the user's JWT
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { global: { headers: { Authorization: `Bearer ${token}` } } }
)
const { data: { user } } = await supabase.auth.getUser()

The main frontend Supabase client must remain a singleton with NO projectId, projectRef, or any extra config:

jsimport { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

The TypeError: Failed to fetch dynamically imported module App.tsx is caused by the auth crash preventing the app from loading. Fixing the auth middleware above will resolve this too.

2. Sign Up page — role and staff type selection
On the Sign Up form, add a role selector that determines where the user is directed after signup:

Role dropdown with options: Student, Housekeeping Staff, Maintenance Staff, Routine Checkup Staff, Admin
When role is Student: show fields — Full Name, University Email, Password, Hostel (H1/H2), Floor, Room Number
When role is Staff (any): show fields — Full Name, University Email, Password only (no room/hostel/floor)
Map selected role to the correct values sent in signup metadata:

Student → role: 'student'
Housekeeping Staff → role: 'staff', staff_type: 'housekeeping'
Maintenance Staff → role: 'staff', staff_type: 'maintenance'
Routine Checkup Staff → role: 'staff', staff_type: 'routine_checkup'
Admin → role: 'admin'


Signup call must pass all relevant metadata:

jsawait supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      name: fullName,
      role: mappedRole,
      staff_type: staffType ?? null,
      room_number: roomNumber ?? null,
      hostel: hostel ?? null,
      floor: floor ?? null
    }
  }
})

After signup, route based on role and staff_type:

student → /student/dashboard
staff + housekeeping → /staff/housekeeping
staff + maintenance → /staff/maintenance
staff + routine_checkup → /staff/routine-checkup
admin → /admin/dashboard



3. Three staff dashboards — same features, filtered by type
Create three separate staff dashboard routes. Each dashboard has identical features but filters data differently:
/staff/housekeeping — HousekeepingDashboard

Task list: bookings where service_type = 'housekeeping' only
Query:

jsconst { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('service_type', 'housekeeping')
  .in('status', ['pending', 'in_progress'])
  .order('date', { ascending: true })
/staff/maintenance — MaintenanceDashboard

Task list: bookings where service_type = 'maintenance' only
Query:

jsconst { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('service_type', 'maintenance')
  .in('status', ['pending', 'in_progress'])
  .order('date', { ascending: true })
/staff/routine-checkup — RoutineCheckupDashboard

Task list: staff_tasks where staff_type = 'routine_checkup' AND assigned_to = currentUser.id
Query:

jsconst { data } = await supabase
  .from('staff_tasks')
  .select('*')
  .eq('staff_type', 'routine_checkup')
  .eq('assigned_to', currentUser.id)
  .order('created_at', { ascending: true })
Features on ALL THREE dashboards (identical):

Task counter at top: Pending: X | In Progress: X | Completed: X — live counts, reactive
Task cards show: student name, room number, hostel, floor, date, time slot, service type, notes
Task flow with ONE button per task:

pending → "Start Task" button → sets status = 'in_progress'
in_progress → "End Task" button → sets status = 'completed', completed_at = now()
completed → "Completed" badge only, no button


Tasks stay visible at ALL stages — never remove from list when status changes
"Door Not Opened" button on pending and in_progress tasks:

jsawait supabase.rpc('report_door_not_opened', {
  p_booking_id: task.id,
  p_staff_id: currentUser.id
})

Notification bell with unread count
Use Supabase realtime subscription to keep task list live

4. Booking network error fix
The "Network error: Failed to fetch" on booking is caused by the same auth client issue. After fixing the auth middleware in fix 1, also ensure:

The booking insert uses the singleton supabase client
Full insert object with all required fields:

jsif (!serviceType || !selectedTimeSlot) {
  setError('Please select a service type and time slot.')
  return
}

const { error } = await supabase.from('bookings').insert({
  user_id: currentUser.id,
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
})

Students can only select dates from today up to 7 days ahead — disable all dates beyond that in the date picker:

jsconst maxDate = new Date()
maxDate.setDate(maxDate.getDate() + 7)
// set date picker max to maxDate
5. Upcoming bookings list — all pending and in_progress regardless of date
The Upcoming Bookings list in admin dashboard must show ALL pending and in_progress bookings — today, tomorrow, and all future dates — not just today:
jsconst { data } = await supabase
  .from('bookings')
  .select('*')
  .in('status', ['pending', 'in_progress'])
  .order('date', { ascending: true })
6. Admin analytics — monthly, resets at start of each month
Replace the current analytics with monthly stats that reset each month:
On admin dashboard load:
js// Get current month stats
const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().split('T')[0]

const { data: bookings } = await supabase
  .from('bookings')
  .select('status')
  .gte('created_at', startOfMonth)

const total      = bookings.filter(b => b.status !== 'cancelled').length
const completed  = bookings.filter(b => b.status === 'completed').length
const cancelled  = bookings.filter(b => b.status === 'cancelled').length
const pending    = bookings.filter(b => b.status === 'pending').length
const inProgress = bookings.filter(b => b.status === 'in_progress').length
const rate       = total > 0 ? ((completed / total) * 100).toFixed(1) : 0
Display monthly stats as:

Total Bookings This Month: {total}
Completed This Month: {completed}
Completion Rate This Month: {rate}%
Cancelled This Month: {cancelled}

At the start of each new month, archive the previous month by calling:
js// Call this once when the month changes
await supabase.rpc('archive_and_reset_monthly_analytics')
Check if current month has changed compared to a stored value in localStorage and call the archive function if it has.
7. Routine checkup JSON error fix
Replace the checkup creation with this exact flow — do NOT pass any JSON arrays:
js// Step 1: Insert checkup
const { data: checkup, error } = await supabase
  .from('routine_checkups')
  .insert({
    hostel: hostel,         // 'H1' or 'H2' only
    floor: floor,
    date: date,
    start_time: startTime,  // 24hr e.g. '09:00'
    time_window: startTime + ' (2h 40min)',
    service_type: 'maintenance',
    created_by: currentUser.id
  })
  .select()
  .single()

if (error) { setError(error.message); return }

// Step 2: Generate 32 slots server-side via RPC
const { error: slotError } = await supabase.rpc('generate_checkup_slots', {
  p_checkup_id: checkup.id,
  p_start_time: startTime
})

if (slotError) { setError(slotError.message); return }

// Step 3: Notify all students on that hostel + floor
const { data: students } = await supabase
  .from('users')
  .select('id')
  .eq('role', 'student')
  .eq('hostel', hostel)
  .eq('floor', floor)

if (students?.length) {
  await supabase.from('notifications').insert(
    students.map(s => ({
      user_id: s.id,
      type: 'checkup_scheduled',
      message: `Routine maintenance checkup on ${date} starting ${startTime} for ${hostel} Floor ${floor}. Book your 5-min slot now.`,
      read: false
    }))
  )
}
8. Student dashboard — checkup pop-up and slot booking
On student dashboard load, check for unread checkup notifications:
jsconst { data: checkupNotifs } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', currentUser.id)
  .eq('type', 'checkup_scheduled')
  .eq('read', false)
If any exist, show a modal pop-up with the message and a "Book Slot" button. The slot booking flow:

Load available slots: checkup_slots where is_booked = false for that checkup
Student picks one slot
On confirm:

jsawait supabase
  .from('checkup_slots')
  .update({ is_booked: true, booked_by: currentUser.id })
  .eq('id', selectedSlot.id)

// Create task for routine checkup staff
await supabase.from('staff_tasks').insert({
  checkup_id: checkup.id,
  assigned_to: routineCheckupStaffId,
  staff_type: 'routine_checkup',
  title: `Checkup: ${profile.name}, Room ${profile.room_number}`,
  description: `${hostel} Floor ${floor} — ${date} at ${selectedSlot.time_slot}`,
  status: 'pending'
})

// Mark notification as read
await supabase
  .from('notifications')
  .update({ read: true })
  .eq('id', notif.id)