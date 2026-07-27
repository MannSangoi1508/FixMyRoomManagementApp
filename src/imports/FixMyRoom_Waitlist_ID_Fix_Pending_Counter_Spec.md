# FixMyRoom — Waitlist ID Fix, Bulk Add & Pending Counter (Backend Fixed)

Backend for the pending task counter is fixed and confirmed at the root cause. The credit refund concern is now closed for good — confirmed correct with clean before/after data (unchanged value across a within-3-hours cancellation). Only the waitlist screen needs frontend work this round.

---

## 1. "Add to Waitlist" Doesn't Remove Names — Root Cause Found

**This was never a missing feature — it's an ID mismatch.** The Waitlist Candidates list is shown under a specific Scheduled Checkup card (in the screenshot, an empty "Maintenance Checkup, 0/32 booked"), but each candidate in that list actually originated from a **different, older** checkup event (where they missed or cancelled). The "Add to Waitlist" button must use **each candidate's own `checkup_id`** — not the `checkup_id` of the card the list happens to be displayed under.

**Fix:** when rendering each candidate row, keep that row's own `checkup_id` value (already present in the `checkup_waitlist_candidates` view) attached to the row's data — do not substitute it with the surrounding card's `checkup_id`. Pass that specific value when calling `add_to_checkup_waitlist(...)`.

A database-level safety net is now also in place: `waitlist_bookings` has a unique constraint on `(checkup_id, student_id)`, so even if this were called with the wrong ID it can no longer silently create duplicate/ineffective entries — but the real fix is using the correct ID in the first place so the exclusion logic in the view actually works and the name disappears from the list as expected.

---

## 2. New Feature: "Add All to Waitlist" Button

New function ready: `add_all_to_checkup_waitlist(candidates)` — takes a JSON array and processes them all in one call, safely skipping any duplicates.

**Build:** add an "Add All to Waitlist" button above the candidates list. On click, build an array from every **currently visible** (respecting whatever filter is applied) candidate row:
```json
[
  { "checkup_id": "...", "student_id": "...", "room_number": "...", "floor": "..." },
  ...
]
```
Each object's `checkup_id` must be that specific candidate's own origin event (same rule as Item 1). Call:
```
add_all_to_checkup_waitlist(p_candidates: <the array above>)
```
Response includes `processed` — show a confirmation like "12 students added to waitlist."

---

## 3. Routine Checkup Staff Pending Counter — Fixed at the Root

Root cause: when an admin cancelled checkup slots (either the whole event via "Cancel Slots," or an individual slot), the corresponding `staff_tasks` row was never updated to `cancelled` — it stayed `pending` forever, inflating the staff dashboard's counter with tasks for slots that no longer exist. Also fixed a secondary bug where individual-slot cancellation matched tasks by fuzzy text instead of the reliable ID link. Existing orphaned pending tasks have been cleaned up.

**No frontend change needed** — verify by checking the routine checkup staff dashboard's Pending count now matches reality (0 if nothing is actually due).

---

## 4. Credit Refund Within 3 Hours — Confirmed Fixed, Closing This Item

Verified with clean before/after data: `weekly_booking_count` stays completely unchanged across a within-3-hours cancellation. This has now been checked multiple times with real numbers and is confirmed correct. **No further action needed on this item** unless a new, specific reproduction case comes up.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Waitlist names not disappearing | Root cause = ID mismatch — needs frontend fix (use candidate's own `checkup_id`) |
| 2 | Bulk "Add All to Waitlist" | New function ready — needs frontend build |
| 3 | Staff pending counter wrong | Fixed at DB level — verify only |
| 4 | Credit refund within 3 hours | **Closed** — confirmed correct with clean data |
