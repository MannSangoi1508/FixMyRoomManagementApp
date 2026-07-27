# FixMyRoom — Waitlist Scheduling, Routine Checkup Booking Flow & Cancellation Messaging

Backend for all items below is live. This is what's left to build/verify on the frontend.

---

## 1. False "Credit Returned" Message on Housekeeping Cancellation

Confirmed via direct database check: the refund logic itself is working correctly (credit is NOT actually restored within 3 hours) — but the popup message shown to the student always says "credit has been returned" regardless of what really happened.

**Fix:** read the cancellation function's actual `credit_returned` field instead of showing a static string:
```js
const result = await cancelBooking(bookingId);
const message = result.credit_returned
  ? "Booking cancelled. Your credit has been returned."
  : "Booking cancelled. No credit was returned (within 3 hours of the slot).";
```

---

## 2. Routine Checkup — Add Cancel Option (Not Just Reschedule)

Backend already fully supports this — `cancel_checkup_slot(slot_id, student_id)` frees the slot (`is_booked` resets to `false`), making it immediately bookable again by anyone, including the same student.

**Fix:** add a "Cancel Booking" option next to "Reschedule" on the student's routine checkup card. No additional logic needed beyond calling the existing function — the slot becomes available again automatically.

---

## 3. Routine Checkup as a Direct "New Booking" Option

New view ready: `student_available_checkup_slots` — returns open, unbooked, future slots for a given hostel/floor.

**Build:** add a third card next to Housekeeping and Maintenance under "New Booking," labeled "Routine Checkup." Query the view filtered to the student's own `hostel`/`floor`:
- If slots exist, show them in the same time-slot grid style as Housekeeping/Maintenance. Selecting one calls `book_checkup_slot(slot_id, student_id, student_name, room_number, hostel, floor)`.
- If none exist, either hide the card or show "No checkup currently open for your floor."

The existing notification-based flow can remain as a secondary reminder path — this just makes booking discoverable without digging through notifications.

---

## 4. New Feature: Admin Waitlist Scheduling Screen

Mirrors the existing "Schedule Checkup" flow, but scoped specifically to students already on the waitlist for a given hostel/floor (from missed/unbooked routine checkups), rather than the whole floor.

**Build:** on the admin's Routine Checkups tab, add a "Schedule Waitlist Session" action (could live alongside the Waitlist Candidates list). Form fields: Hostel, Floor, Date, Start Time, Slot Duration (minutes) — same inputs as the existing Schedule Checkup form.

On submit, call:
```
admin_schedule_waitlist_session(
  p_hostel, p_floor, p_date, p_start_time, p_slot_duration, p_admin_id: <current admin id>
)
```

This function automatically:
- Creates a new checkup event sized exactly to however many students are actually waitlisted for that hostel/floor (not a fixed 32 slots).
- Notifies each waitlisted student individually to book.
- Marks those waitlist entries as `completed` so they naturally clear from the Waitlist Candidates list.
- Logs the action in the Admin Activity Log.

Response includes `students_notified` — show this count to the admin as confirmation (e.g. "Session created, 3 students notified").

---

## 5. Door Not Opened → Waitlist Flow — Now Fixed, Please Verify

Root cause found and fixed: the routine checkup door-not-opened path wasn't setting the `door_not_opened` flag on the slot (only marking it completed), so affected students never appeared in the waitlist candidates list. Also fixed several `NOT NULL`/check-constraint mismatches on `waitlist_bookings` (`session_id`, `assigned_time`, and the `status` value now correctly uses `'upcoming'`).

**Verify:** mark a routine checkup task as "Door Not Opened" — the student should appear in Waitlist Candidates tagged "Door Not Opened," and adding them to the waitlist should succeed without error.

---

## 6. Routine Checkup Booking Now Properly Links to Staff Tasks

Root cause found: two versions of `book_checkup_slot` existed with different parameters; only the unused one had the staff-task linking fix applied. The version actually called by the booking form (6 parameters: slot, student, name, room, hostel, floor) is now the fixed one.

**Verify:** book a new routine checkup slot as a student, then confirm "Start Task" and "Door Not Opened" both work for that slot on the routine checkup staff dashboard (no more "No staff task linked yet").

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | False "credit returned" message | Frontend fix — read real `credit_returned` field |
| 2 | Routine checkup cancel + rebook | Backend ready — needs frontend button |
| 3 | Routine checkup in New Booking | Backend ready — needs frontend card build |
| 4 | Admin waitlist scheduling screen | New feature — backend ready, needs frontend build |
| 5 | Door Not Opened → waitlist | Fixed at DB level — verify only |
| 6 | Routine checkup staff task linking | Fixed at DB level — verify only |
