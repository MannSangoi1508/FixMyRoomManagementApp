Add the following 14 features to the existing app. Do not break or modify anything that is already working.
1. Flagged Students — Admin Panel

Admin sees a list of flagged students (where flagged = true in users table)
Each row shows: student name, room number, email, flag reason
"Notified" button next to each student — clicking sets flagged = false and flag_reason = null for that student only:

jsawait supabase.from('users')
  .update({ flagged: false, flag_reason: null })
  .eq('id', student.id)

"Notified All" button at top — clears all flagged students at once:

jsawait supabase.from('users')
  .update({ flagged: false, flag_reason: null })
  .eq('role', 'student')
  .eq('flagged', true)

Flagged students are NOT reset by the weekly Monday reset — only cleared via Notified/Notified All buttons
After either action, refresh the flagged list immediately

2. Announcements — Separate Section

Add an "Announcements" section in the admin dashboard
Admin composes an announcement with:

Text content field
Target dropdown: "Students only", "Staff only", "Both"


On submit, insert into a new announcements table:

jsawait supabase.from('announcements').insert({
  content: announcementText,
  target: target,   // 'students', 'staff', 'both'
  created_by: currentUser.id,
  created_at: new Date().toISOString()
})

Students see an "Announcements" tab in their dashboard — fetch only where target IN ('students', 'both'):

jsconst { data } = await supabase.from('announcements')
  .select('*')
  .in('target', ['students', 'both'])
  .order('created_at', { ascending: false })

Staff see an "Announcements" tab in their dashboard — fetch only where target IN ('staff', 'both'):

jsconst { data } = await supabase.from('announcements')
  .select('*')
  .in('target', ['staff', 'both'])
  .order('created_at', { ascending: false })

Student announcements never appear for staff and vice versa

3. Show/Hide Password on Login and Sign Up

Add an eye icon button inside the password field on the login screen and sign up screen for all user types
Clicking toggles type between password and text on the input field:

jsconst [showPassword, setShowPassword] = useState(false)
<div style={{ position: 'relative' }}>
  <input type={showPassword ? 'text' : 'password'} ... />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
    {showPassword ? '🙈' : '👁️'}
  </button>
</div>
4. Housekeeping and Maintenance Staff — New Filters and Booking Lists

Replace the existing Status, Date, Hostel filters with: Date, Hostel (All/H1/H2), Floor (All/1–11)
Upcoming Bookings list — pending + in_progress, sorted by time_slot ascending (earliest first):

jslet query = supabase.from('bookings').select('*')
  .eq('service_type', 'housekeeping')   // or 'maintenance'
  .in('status', ['pending', 'in_progress'])
if (dateFilter !== 'all') query = query.eq('date', dateFilter)
if (hostelFilter !== 'all') query = query.eq('hostel', hostelFilter)
if (floorFilter !== 'all') query = query.eq('floor', floorFilter)
const { data } = await query.order('time_slot', { ascending: true })

Completed Bookings list — most recent completed on top:

jslet query = supabase.from('bookings').select('*')
  .eq('service_type', 'housekeeping')   // or 'maintenance'
  .eq('status', 'completed')
  .gte('completed_at', weekStart)
if (hostelFilter !== 'all') query = query.eq('hostel', hostelFilter)
if (floorFilter !== 'all') query = query.eq('floor', floorFilter)
const { data } = await query.order('completed_at', { ascending: false })

Every booking card clearly labelled with service type — show "Emergency" label if is_emergency = true, otherwise show "Housekeeping" or "Maintenance"

5. Notification Counter — Student Dashboard

Bell icon on the main student dashboard header shows a red badge with the count of unread notifications (read = false)
Clicking the bell navigates to the Notifications tab
Use realtime subscription to keep the count live:

jsconst { count } = await supabase.from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', currentUser.id)
  .eq('read', false)
setUnreadCount(count ?? 0)
6. Pending Bookings Counter — Admin Dashboard

Show a stat box on admin dashboard: "Pending Tasks" = count of bookings where status IN ('pending', 'in_progress') for the current week
Resets to 0 every Monday 12:00am via client-side check:

jsfunction getMonday(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}
const weekStart = getMonday().toISOString()
const { count } = await supabase.from('bookings')
  .select('*', { count: 'exact', head: true })
  .in('status', ['pending', 'in_progress'])
  .gte('created_at', weekStart)
setWeeklyPendingCount(count ?? 0)
7. Weekly Auto-Reset — Client-Side Timer

On every dashboard load check if the current Monday has changed since the last stored reset:

jsconst lastReset = localStorage.getItem('lastWeeklyReset')
const thisMonday = getMonday().toISOString()
if (!lastReset || lastReset < thisMonday) {
  await supabase.rpc('reset_weekly_counts')
  localStorage.setItem('lastWeeklyReset', thisMonday)
}

Apply this reset check on: student dashboard load, each staff dashboard load, admin dashboard load
Flagged students are NOT affected by this reset — their flag is only cleared by Notified/Notified All

8. Cancel Routine Checkup Slots — Admin

In the admin Routine Checkup tab, add a "Cancel Slots" action
Admin selects: Floor, Date, Time Range (start time – end time)
On confirm, find all matching slots and cancel them:

js// Find checkup for that floor and date
const { data: checkup } = await supabase.from('routine_checkups')
  .select('id')
  .eq('floor', selectedFloor)
  .eq('date', selectedDate)
  .single()

// Get slots within time range
const { data: slots } = await supabase.from('checkup_slots')
  .select('*')
  .eq('checkup_id', checkup.id)
  .gte('time_slot', startTime)
  .lte('time_slot', endTime)
  .eq('is_booked', true)

// Cancel each slot and notify the student
for (const slot of slots) {
  await supabase.from('checkup_slots')
    .update({ is_booked: false, booked_by: null, is_cancelled: true, cancelled_at: new Date().toISOString() })
    .eq('id', slot.id)

  await supabase.from('staff_tasks')
    .update({ status: 'cancelled' })
    .eq('checkup_id', checkup.id)

  if (slot.booked_by) {
    await supabase.from('notifications').insert({
      user_id: slot.booked_by,
      type: 'checkup_cancelled',
      message: `Your routine checkup slot on ${selectedDate} at ${slot.time_slot} has been cancelled by admin.`,
      read: false
    })
  }
}
// Refresh checkup tab
await fetchCheckups()
9. Custom Time-Per-Slot for Routine Checkups

When admin creates a routine checkup, replace fixed 5-min slots with a slot duration selector:

Dropdown options: 3 min, 5 min, 7 min, 10 min, Custom (number input)


Show a live preview before confirming:

jsconst totalMinutes = slotDuration * 32
const hours = Math.floor(totalMinutes / 60)
const mins = totalMinutes % 60
const endTime = addMinutes(startTime, totalMinutes)
// Show: "5 min × 32 rooms = 2 hrs 40 mins — slots from 09:00 to 11:40"

Generate 32 slots using the chosen duration by calling the RPC:

jsawait supabase.rpc('generate_checkup_slots_custom', {
  p_checkup_id:    checkup.id,
  p_start_time:    startTime,
  p_slot_duration: slotDuration   // in minutes
})

Save slot_duration in the routine_checkups row for reference

10. Room-Wise Task History Log — Admin

Add a "Room History" section in admin dashboard
Admin selects a room number from a searchable dropdown (populated from bookings.room_number distinct values)
Fetch all tasks for that room:

jsconst { data: history } = await supabase.from('bookings')
  .select('id, service_type, date, time_slot, status, completed_at, assigned_staff_name, user_name, is_emergency')
  .eq('room_number', selectedRoom)
  .order('date', { ascending: false })

Add checkup history too:

jsconst { data: checkupHistory } = await supabase
  .from('checkup_slots')
  .select(`id, time_slot, completed_at, student_name, room_number,
    routine_checkups(date, hostel, floor)`)
  .eq('room_number', selectedRoom)
  .order('created_at', { ascending: false })

Display columns: Task Type, Date, Time, Staff Name, Status
Filter controls: Task Type (All/Housekeeping/Maintenance/Emergency/Routine Checkup), Date Range (from/to)

11. Staff Attendance Tracker — Admin

Add an "Attendance" section in admin dashboard
Admin sees list of all staff members (role = 'staff')
For each staff member, for each day shown, admin marks Present or Absent:

jsawait supabase.from('staff_attendance').insert({
  staff_id:   staffMember.id,
  date:       selectedDate,
  status:     'present',   // or 'absent'
  marked_by:  currentUser.id
})

View attendance history per staff member — table of dates with Present/Absent status
No auto-reassignment — purely tracking

12. Student Complaint and Feedback System

Add a "Complaints" tab in student dashboard
Student submits a complaint with: type (Complaint/Feedback), subject, description
After submission, student can add follow-up comments but cannot edit or delete the original
Insert complaint:

jsawait supabase.from('complaints').insert({
  user_id:     currentUser.id,
  user_name:   profile.name,
  room_number: profile.room_number,
  type:        complaintType,
  subject:     subject,
  description: description,
  status:      'received'
})

Follow-up comments stored in complaint_comments table linked by complaint_id
Student sees status of each complaint: Received → Reviewed → Resolved (shown as a badge)
Admin sees all complaints in a "Complaints" panel — not visible to any staff
Admin can update status:

jsawait supabase.from('complaints')
  .update({ status: newStatus })
  .eq('id', complaint.id)

When admin updates status, send notification to student

13. Routine Checkup Waitlist

When admin views the flagged/missed list after a checkup, a "Create Waitlist Session" button appears
Admin inputs: start time, time per slot (same duration picker as feature 9)
System auto-calculates: missed rooms × time per slot = total session duration
Preview shown: "12 missed rooms × 5 min = 1 hr — slots from 14:00 to 15:00"
On confirm:

Sort missed rooms: lowest floor first, within floor lowest room number first
Assign slots sequentially — lowest room number gets earliest slot
Insert new checkup_slots rows for each missed room with pre-assigned time
Notify each affected student with ONLY their assigned time — no booking option shown:



jsawait supabase.from('notifications').insert({
  user_id:  student.id,
  type:     'waitlist_assigned',
  message:  `You have been assigned a routine checkup slot on ${date} at ${assignedTime}. No action needed.`,
  read:     false
})
14. Admin Activity Log

Every admin action is recorded in an admin_activity_log table with: admin_id, action_type, description, created_at
Log the following actions automatically when they happen:

Announcement sent: "Announcement sent to [target]: [first 50 chars of content]"
Flag removed (individual): "Flag removed for student [name], Room [room_number]"
Flag removed (all): "All student flags cleared"
Checkup slots cancelled: "Checkup slots cancelled — Floor [floor], Date [date], [startTime]–[endTime]"
Checkup slots created: "Routine checkup created — Floor [floor], Date [date], [duration] min × 32 = [total] mins"
Waitlist session created: "Waitlist session created — [n] rooms, [duration] min/slot, starts [startTime]"
Attendance marked: "Attendance marked — [staff_name]: [present/absent] on [date]"
Complaint status updated: "Complaint [id] updated to [status] for [student_name]"


Log is viewable in a "Activity Log" section in admin dashboard — read only
Filter by: Action Type, Date Range
Insert log entry helper:

jsasync function logAdminAction(actionType, description) {
  await supabase.from('admin_activity_log').insert({
    admin_id:    currentUser.id,
    action_type: actionType,
    description: description,
    created_at:  new Date().toISOString()
  })
}