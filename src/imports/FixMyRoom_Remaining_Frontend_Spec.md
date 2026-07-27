# FixMyRoom — Remaining Frontend Work: Consolidated Spec

All backend SQL for these items is confirmed live and independently verified (triggers and functions checked directly against `pg_trigger`/`pg_proc`, not assumed). This is everything still needed on the frontend.

---

## 1. Admin Activity Log — Now Fully Wired, Needs Testing

All 8 Action Type filter options now have real triggers writing to `admin_activity_log`:

| Filter Option | Trigger/Function |
|---|---|
| Announcement Sent | `trg_log_announcement_activity` |
| Complaint Updated | `trg_log_complaint_activity` |
| Checkup Created | `trg_log_checkup_created` |
| Checkup Slots Cancelled | `trg_log_checkup_slot_cancelled` |
| Attendance Marked | `trg_log_attendance_marked` |
| Waitlist Created | `trg_log_waitlist_created` |
| Flag Removed (Individual) | `remove_student_flag(student_id)` function |
| Flag Removed (All) | `remove_all_flags()` function |

**Action needed for the two flag options specifically:** the admin's "Remove Flag" button (individual) and "Remove All Flags" button need to actually call `remove_student_flag(p_student_id)` and `remove_all_flags()` respectively — these functions both update the student(s) AND write the log entry in one step. If the buttons currently do a direct table update instead, switch them to call these functions, or the log entries still won't appear even though the underlying capability now exists.

**Test:** cancel a checkup slot, send an announcement, mark attendance, create a waitlist entry, remove a flag — each should produce a new Activity Log row within seconds, and filtering by that specific type should surface it.

---

## 2. New Feature: Slot Availability Under Each Time Button

Function `get_slot_availability(service_type, date, hostel, floor)` is live and ready — returns one row per 15-minute slot with `booked_count` and `max_slots` (null = unlimited, for maintenance).

**Build:** in the student's booking time-picker, call this function once a date is selected, and render availability directly under each time button (e.g. under "1:00 PM - 1:15 PM" show "0/1 rooms" in green, or red/greyed + unclickable if full). Matches the reference screenshot exactly — inline under each button, not a separate grid.

---

## 3. Routine Checkup "View Slots" — Still Not Showing Room/Student Name

Confirmed via direct query that the underlying data is correct (`room_number`, `student_name`, `is_booked` all populate properly on `checkup_slots` when a student books). This remains a pure frontend rendering bug on the expanded "View Slots" list — check what fields that specific row template is bound to and correct it to read `room_number` / `student_name` from the slot data.

---

## 4. Admin Schedule Overview — Confirm the Latest View Landed

Given today's pattern of changes silently not taking effect, worth explicitly re-verifying this specific update actually applied:

```sql
create or replace view public.admin_schedule_overview as
select
    b.id, b.service_type, b.room_number, b.hostel, b.floor,
    b.status, b.is_emergency, b.date, b.completed_at, b.cancelled_at, b.cancelled_by
from public.bookings b
where b.date >= current_date

union all

select
    cs.id, 'routine_checkup' as service_type, cs.room_number, cs.hostel, cs.floor,
    case when cs.is_cancelled then 'cancelled'
         when cs.completed_at is not null then 'completed'
         else 'pending' end as status,
    false as is_emergency, rc.date, cs.completed_at, cs.cancelled_at, null as cancelled_by
from public.checkup_slots cs
join public.routine_checkups rc on rc.id = cs.checkup_id
where cs.is_booked = true
  and rc.date >= current_date;
```

This shows: today's bookings regardless of status (pending/in-progress/completed), all future bookings, and excludes any routine checkup slot that was never booked. If Schedule Overview still shows unbooked slots or past dates, re-run this exact statement and confirm success before checking the frontend again.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Activity Log — 8 action types | Backend confirmed live — wire flag buttons to new functions, then test all 8 |
| 2 | Slot availability display | Function ready — needs frontend build |
| 3 | View Slots missing room/student name | Frontend binding bug — data confirmed correct |
| 4 | Schedule Overview scope | Re-verify this exact view is what's live, then check frontend |
