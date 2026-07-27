# FixMyRoom — Final Frontend Fixes: Credit Display, Routine Checkup UI & Waitlist Filter

All backend work for this round is complete and independently verified against real data (not just assumed). Everything below is frontend-only.

---

## 1. Credit Refund Message — Read the Real Response Value

Confirmed conclusively via direct database checks (repeated twice, same result both times): the backend correctly does NOT refund credit when a housekeeping booking is cancelled within 3 hours. `weekly_booking_count` stays unchanged after such a cancellation — proven by watching the real number before and after.

The confirmation message text is already correct ("credit won't be returned"). No change needed there.

---

## 2. NEW BUG: Weekly Bookings Badge Shows 0/1 After a Non-Refunding Cancellation

Even though the message is correct and the real database value stays at 1/1 after cancelling within 3 hours, the **badge on screen** changes to 0/1 immediately. Since we've proven the actual stored/calculated value never changes in this scenario, this means the badge is being updated via local optimistic UI logic (decrementing a local counter on any cancel action) instead of re-fetching the real value from the backend.

**Fix:** after any cancellation completes, re-fetch the weekly booking count from its actual source (`student_weekly_housekeeping_status` view / whatever function currently powers this badge) rather than decrementing a local variable. The badge must always reflect the true server-side value, never assume a cancel always frees up a credit.

**Acceptance:** cancel a housekeeping booking within 3 hours — badge stays at 1/1 (matching the "no credit returned" message). Cancel one more than 3 hours out — badge correctly drops to 0/1 in that case, since that one IS eligible for refund.

---

## 3. Remove "Reschedule" for Routine Checkup Bookings, Keep Only "Cancel"

Per direction — the routine checkup booking card on the student dashboard should only offer "Cancel," not "Reschedule." Cancelling frees the slot; the student can book again later through any of the three booking entry points (Routine Checkup card, pop-up, Notifications) whenever they choose.

---

## 4. Waitlist Candidates Filter — Add Third Option

The `checkup_waitlist_candidates` view already returns three distinct `reason` values: `"Door Not Opened"`, `"Never Booked"`, and `"Cancelled - Not Rebooked"`. The filter dropdown on the admin's Waitlist Candidates list currently only offers the first two.

**Fix:** add "Cancelled - Not Rebooked" as a third option in that filter dropdown, alongside the existing two.

---

## 5. Cancelled Slots History — Show Room Number

The admin's "Cancelled Slots" section (under each Scheduled Checkup) currently shows "Room: N/A" — because the live `room_number` field is intentionally cleared when a slot is cancelled (it's reused for the next booking). A new column, `cancelled_room_number`, was added specifically to preserve this for historical display.

**Fix:** bind the Cancelled Slots list to `cancelled_room_number` instead of `room_number`.

---

## 6. Routine Checkup Card — Show All Open Events, Not Just One

The "Routine Checkup" booking card on the student dashboard currently only displays one checkup event even when multiple are open simultaneously (e.g. two different time-window events on the same day). The underlying data already includes all of them — this is purely a rendering gap.

**Fix:** group the available slots by `checkup_id` and render one card per distinct event, instead of only showing the first event found.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Credit refund message | Confirmed correct — no change needed |
| 2 | Weekly bookings badge showing wrong number after cancel | **New bug** — needs frontend fix (re-fetch, don't locally decrement) |
| 3 | Remove Reschedule, keep Cancel only | Frontend-only |
| 4 | Waitlist filter missing 3rd option | Frontend-only |
| 5 | Cancelled Slots showing "Room: N/A" | Frontend-only — bind to `cancelled_room_number` |
| 6 | Routine Checkup card shows only 1 event | Frontend-only — group by `checkup_id` |
