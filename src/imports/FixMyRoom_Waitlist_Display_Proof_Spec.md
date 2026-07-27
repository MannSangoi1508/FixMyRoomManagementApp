# FixMyRoom — Waitlist Display Bug (Proven) + Two Unfinished Items

Nothing backend needs to change here — everything below is either a frontend bug proven by direct data comparison, or work your own to-do list shows as incomplete.

---

## 1. Waitlist Candidates Not Showing "Door Not Opened" / "Cancelled - Not Rebooked" — Proven Frontend-Only

Direct database proof: real data exists and the view correctly returns it.

```
door_not_opened_count: 15
cancelled_not_rebooked_count: 5
```

And querying `checkup_waitlist_candidates` directly returns real rows, e.g.:
```
Student 1, Room 619, checkup_id d2c2e9fa-..., reason: Door Not Opened
Student 1, Room 619, checkup_id 7669a4ef-..., reason: Cancelled - Not Rebooked
```

**This proves the data and the view are both correct.** The admin's Waitlist Candidates screen for these checkup events is either:
- Not querying `checkup_waitlist_candidates` at all for these events, or
- Applying a filter/join that excludes them before display (e.g. filtering to only "Never Booked" somewhere, or matching on the wrong `checkup_id`).

**Action needed:** compare the query actually powering the Waitlist Candidates list against `select * from checkup_waitlist_candidates where checkup_id = <the event being viewed>` — they should return identical rows. Find and fix wherever they diverge.

---

## 2. Two Items From Your Own To-Do List Appear Unfinished

Per the to-do list shown in your last update — it starts at "Item 2," meaning **Item 1 is missing entirely** (this was the credit-refund confirmation message fix from the previous round), and the final item, "Updating Routine Checkup card to show all events," is still marked in-progress, not complete.

**Action needed:**
- Confirm whether Item 1 (credit refund message — already confirmed correct on the backend, just needed the frontend to display it accurately if it wasn't already) was actually completed or skipped.
- Finish "Updating Routine Checkup card to show all events" — this was the fix for the card only displaying one open checkup event when multiple exist simultaneously; group by `checkup_id` and render one card per distinct event.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Waitlist Candidates missing 2 of 3 categories | Proven frontend-only — data and view both confirmed correct |
| 2 | Credit message + multi-event Routine Checkup card | Confirm/finish — your own to-do list shows these incomplete |
