# FixMyRoom — Start Task Fix & Routine Checkup Waitlist Feature

Backend for both items is live. This is what's left to verify/build on the frontend.

---

## 1. Start Task — Fixed

Root cause: `start_checkup_task` never actually existed — it was part of an earlier SQL batch that stopped early due to an unrelated error before reaching this function's creation statement. It's now created and confirmed live.

**No frontend change needed** — the button was already calling the correct function name/params from the earlier round. Retest: tap "Start Task" on an active routine checkup task — should move it to "In Progress" with no error.

---

## 2. New Feature: Routine Checkup Waitlist Candidates List

Shows, per checkup event, everyone who should be considered for the waitlist — split clearly into two categories so multiple names are never ambiguous:
- **"Door Not Opened"** — booked a slot, but staff reported the door wasn't opened.
- **"Never Booked"** — a student in that hostel/floor who never booked any slot for that checkup event at all.

Both come from one view, `checkup_waitlist_candidates`, with columns: `student_id`, `student_name`, `room_number`, `hostel`, `floor`, `checkup_id`, `reason` (one of the two labels above).

**Build:** on the admin's Routine Checkups screen, under each Scheduled Checkup card, add a section listing candidates from this view filtered to that event's `checkup_id`. Display each row with the student's name, room number, and a clearly distinct badge for `reason` (e.g. red for "Door Not Opened", grey for "Never Booked"). Add a filter dropdown to show All / Door Not Opened only / Never Booked only.

**"Add to Waitlist" button** per row should call:
```
add_to_checkup_waitlist(
  p_checkup_id: <the event's checkup_id>,
  p_student_id: <student's id>,
  p_room_number: <student's room_number>,
  p_floor: <student's floor>
)
```
Once added, that student automatically disappears from the candidates list on next refresh — the view itself excludes anyone already present in `waitlist_bookings` for that event, so no separate "remove from list" logic is needed on the frontend.

**Note on existing `waitlist_bookings.session_id`:** left untouched since it's an integer while `routine_checkups.id` is a uuid — they don't correspond to the same thing. A new `checkup_id` (uuid) column was added instead and is what this feature actually uses. If `session_id` is used elsewhere in the app, it's unaffected by this change.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Start Task error | Fixed at DB level — verify only |
| 2 | Waitlist candidates list (Door Not Opened + Never Booked) | New feature — backend ready, needs frontend build |
