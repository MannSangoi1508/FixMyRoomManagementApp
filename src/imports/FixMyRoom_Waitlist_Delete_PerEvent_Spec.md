# FixMyRoom — Waitlist Delete, Per-Event Filtering & Cancel Wiring (Explicit Frontend Tasks)

Backend for all items below is confirmed ready and live. **These are pure frontend build tasks — please implement all three this round.**

---

## 1. Waitlist Candidates Showing the Same List Under Every Event — Frontend Bug

Confirmed via direct database proof in an earlier round: `checkup_waitlist_candidates` correctly returns each candidate tagged with their own specific `checkup_id`, tied to the exact event they missed/cancelled. If every event's card is showing an identical candidate list, the query powering that section is **not filtering by that card's own `checkup_id`** — it's likely pulling the whole table unfiltered.

**Fix:** wherever the Waitlist Candidates list is rendered under a Scheduled Checkup card, the query must be:
```
select * from checkup_waitlist_candidates where checkup_id = <this specific card's checkup_id>
```
Every event card should show its own distinct set of candidates — students who, for **that specific event**, either never booked, had door-not-opened, or booked-and-cancelled. Two different events should essentially never show identical lists unless coincidentally the exact same students happen to match both independently.

---

## 2. "Delete Waitlist" Button — Not Yet Built

Function `clear_waitlist(p_checkup_id)` has existed and been ready since an earlier round.

**Build:** add a "Delete Waitlist" button next to the existing "Add All to Waitlist" button, under each event's Waitlist Candidates section. On click, call:
```
clear_waitlist(p_checkup_id: <this event's checkup_id>)
```
This deletes every `waitlist_bookings` entry tied to that specific event only — it does not touch waitlist entries for other events. Show the returned `deleted` count as confirmation (e.g. "5 entries removed").

---

## 3. Confirm "Cancel Slots" Actually Calls the Right Function

The database view that lists Scheduled Checkups now correctly excludes any event where every slot has been cancelled — but this only works if cancelling actually marks all those slots as cancelled in the first place. **Action needed:** verify the "Cancel Slots" button calls `admin_cancel_checkup_event(checkup_id, admin_id)` — not an older function or a partial/individual-slot cancel action. This function also automatically clears that event's waitlist entries as part of cancellation, so confirming this one call is correct closes out both "event won't disappear after cancelling" and "waitlist not cleared on cancel" at once.

**Verify:** cancel all slots for an event — it should immediately disappear from the admin's Scheduled Checkups list, and its Waitlist Candidates (if any had been added) should be gone too.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Same waitlist list shown under every event | Frontend bug — needs `checkup_id` filter added to the query |
| 2 | "Delete Waitlist" button | Not yet built — function ready, needs frontend wiring |
| 3 | Cancelled events not disappearing | Confirm/fix which function "Cancel Slots" calls |
