Fix and rebuild the following in the FixMyRoom app. Do not break existing auth or routing logic.
1. WEEKLY BOOKING COUNTER

Student dashboard shows weekly booking usage as "X/1" where X is the actual count
Read weekly_booking_count from the users table for the logged-in student
Display it as {weekly_booking_count}/1 so it shows "0/1" or "1/1" not just "/1"
After a student makes a booking, increment weekly_booking_count by 1 in the users table
When admin cancels a housekeeping booking, decrement weekly_booking_count by 1 (minimum 0)

2. EMERGENCY SLOTS

Emergency slots are 1-hour windows from 1pm to 9pm daily (8 slots: 13:00-14:00, 14:00-15:00, 15:00-16:00, 16:00-17:00, 17:00-18:00, 18:00-19:00, 19:00-20:00, 20:00-21:00)
Display these correctly in the booking form when student selects emergency

3. BOOKINGS VISIBILITY

When a student submits a booking it must immediately appear in:

Student's own "Upcoming Bookings" section
Student's "Schedule" view
Admin dashboard booking list with: student name, room number, hostel, floor, date, time slot, service type, status
Relevant staff dashboard (housekeeping staff see only housekeeping bookings, maintenance staff see only maintenance bookings)


All these views must query the bookings table in real time using Supabase realtime subscription
Always send these fields on booking insert: user_id, user_name, room_number, hostel, floor, service_type, date, time_slot, notes, is_emergency, status: 'pending', assigned_staff: null, assigned_staff_name: 'Pending Assignment'

4. REMOVE PRIORITY EVERYWHERE

Remove the priority field from all forms, displays, tables, filters, and dashboards entirely
Do not reference priority anywhere in the UI or database queries

5. STAFF TASK FLOW (pending → in_progress → completed)

Each task card shows ONE action button based on current status:

If status = 'pending' → show "Start Task" button → clicking sets status to 'in_progress'
If status = 'in_progress' → show "End Task" button → clicking sets status to 'completed' and sets completed_at to now
If status = 'completed' → show "Completed" label, no button


Tasks must remain visible in the staff dashboard at ALL stages (pending, in_progress, completed)
Never remove a task from the dashboard when it moves to in_progress
Staff task counter at top of dashboard must show live counts: Pending: X | In Progress: X | Completed: X — update these counts reactively when status changes

6. THREE SEPARATE STAFF DASHBOARDS

There are 3 staff types stored in the users table as staff_type column: 'housekeeping', 'maintenance', 'routine_checkup'
Create 3 completely separate dashboard views:

HousekeepingDashboard: shows only bookings where service_type = 'housekeeping'
MaintenanceDashboard: shows only bookings where service_type = 'maintenance'
RoutineCheckupDashboard: shows only routine checkup tasks assigned to them


Route staff to the correct dashboard after login based on their staff_type field
A housekeeping booking must never appear in maintenance dashboard and vice versa

7. ADMIN CANCEL/OVERRIDE BOOKING

On every booking row in admin dashboard, add a "Cancel Booking" button
When admin clicks Cancel Booking:

Set booking status to 'cancelled' in bookings table
If service_type = 'housekeeping': decrement student's weekly_booking_count by 1 (do not go below 0) in users table
If service_type = 'maintenance': no credit returned
Insert a notification for the student in notifications table:

If housekeeping: message = "Your housekeeping booking on [date] at [time_slot] was cancelled by admin. Your booking credit has been returned."
If maintenance: message = "Your maintenance booking on [date] at [time_slot] was cancelled by admin."


Remove the booking from upcoming bookings display for the student



8. ROUTINE CHECKUP (maintenance only)

Routine checkup is only for maintenance service type
Hostels are named H1 and H2 only
Admin creates a routine checkup by filling:

Hostel: dropdown with H1 and H2
Floor: text input
Date: date picker
Start Time: 24-hour time input (e.g. 09:00)
The checkup window is 2 hours 40 minutes from start time
Automatically generate 32 slots of 5 minutes each starting from the entered start time
Save checkup to routine_checkups table
Save all 32 slots to checkup_slots table with is_booked = false


After admin creates checkup:

Send a push notification AND a pop-up on the student dashboard to every student where hostel matches AND floor matches
Pop-up message: "Routine maintenance checkup scheduled on [date] starting [start_time] for [hostel] Floor [floor]. Please book your 5-minute slot now."
Pop-up has a "Book Slot" button that opens slot selection
Student selects one available 5-min slot and confirms
On confirmation: mark slot as is_booked = true, booked_by = user_id in checkup_slots
Add a task in the routine checkup staff's dashboard for that slot
Add the checkup to admin's schedule view
If student does NOT book a slot before the checkup start time, flag the student (set flagged = true in users table and insert a notification to admin)



9. STUDENT FLAGGING

Students are flagged in two cases:

They do not book a routine checkup slot before the start time
Staff reports "door not opened" twice consecutively for the same student


Flagging means: set flagged = true in the users table for that student
Admin sees a "Flagged Students" section in their dashboard showing: student name, room number, email, reason for flag
A flagged student gets a notification: "You have been flagged. Please contact the warden."

10. STAFF "DOOR NOT OPENED" REPORT

On each in_progress or pending task in the staff dashboard, add a "Door Not Opened" button
When staff taps it:

Insert a record into door_not_opened_reports table: id, booking_id, student_id, reported_by, created_at
Send admin a notification: "Staff reported door not opened for [student name], Room [room_number] on [date]"
Check if this student has 2 or more consecutive door_not_opened_reports — if yes, flag the student (set flagged = true in users table) and notify admin with student name, room number, email



11. NOTIFICATIONS — MARK AS READ

Notifications panel shows all notifications for the logged-in user
Unread notifications (read = false) are highlighted (e.g. bold or colored background)
Each notification has a "Mark as read" button — clicking it sets read = true in notifications table for that notification id
At the top of the panel: "Mark all as read" button — sets read = true for all notifications where user_id = current user
The red bubble on the bell icon shows the count of notifications where read = false
When count reaches 0 the red bubble disappears
Use Supabase realtime on the notifications table so the bubble updates live