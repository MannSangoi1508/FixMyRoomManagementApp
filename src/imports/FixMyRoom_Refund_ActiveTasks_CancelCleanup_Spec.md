# FixMyRoom — Refund Duplicate Fix, Active Tasks Timing & Cancelled Checkup Cleanup

Backend SQL for all three items is live. This is what's left to build/verify on the frontend.

---

## 1. Housekeeping Refund Within 3 Hours — Root Cause Found

There were **two versions of `admin_cancel_booking`** with different parameter counts (`(uuid)` and `(uuid, uuid)`). The 2-argument version had no 3-hour check at all — it refunded unconditionally for any housekeeping or emergency booking. Both versions now share the same correct logic (refund only if housekeeping, non-emergency, and cancelled more than 3 hours before the slot), so it no longer matters which one gets called.

**Action needed:** confirm which cancel function the student's own "Cancel Booking" button actually calls (`student_cancel_booking`, `cancel_booking`, or one of the `admin_cancel_booking` versions). If it's calling an admin function for a student's own action, that's worth pointing at `student_cancel_booking` specifically going forward — it's the most complete version (also handles the maintenance 3-hour cancel-block correctly).

**Verify:** cancel a housekeeping booking within 3 hours of its slot — credit should NOT be returned.

---

## 2. Routine Checkup Staff — Active Tasks Timing

**Problem:** a booked slot correctly appeared in "Today's Checkup Queue" before its time, but once the slot time passed, it vanished from both the queue and Active Tasks instead of moving into Active Tasks and staying there until completed.

**Fixed:** two views now exist with a clean split:
- `routine_checkup_queue` — today's booked, not-yet-due slots (upcoming, not yet time).
- `routine_checkup_active_tasks` — booked slots whose time has arrived but are still not completed/cancelled. Stays here indefinitely until staff marks it done — no more disappearing.

**Action needed:** point the "Active Tasks" section of the staff dashboard at `routine_checkup_active_tasks` (this section was likely reading from an empty/wrong source before, since the view didn't previously exist). "Today's Checkup Queue" keeps its same name, just now correctly excludes anything already due.

**Verify:** book a slot for a near-future time, wait until that time passes without marking it complete — it should move from the Queue into Active Tasks and remain there.

---

## 3. Admin-Cancelled Checkup Events Not Disappearing

**Problem:** "Cancel Slots" only cancelled the individually booked slot within an event, not the event as a whole — so a fully-cancelled checkup event kept lingering in both the admin's Routine Checkups list and the staff's Upcoming Checkup Events.

**Fixed:** new function `admin_cancel_checkup_event(checkup_id)` cancels every slot in the event at once and notifies any students who had booked. The `routine_checkup_events_upcoming` view now automatically excludes any event where all slots are cancelled.

**Action needed:** wire the "Cancel Slots" button (admin Routine Checkups tab) to call `admin_cancel_checkup_event(checkup_id)` instead of whatever it currently calls.

**Verify:** cancel all slots for an event — it should disappear from both the admin's Routine Checkups list and the routine checkup staff's Upcoming Checkup Events.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Housekeeping refund within 3 hours | Fixed at DB level — confirm which function the button calls |
| 2 | Active Tasks not activating/persisting at slot time | Fixed at DB level — needs frontend to point at new view |
| 3 | Cancelled checkup events still showing | Fixed at DB level — needs frontend button rewire |
