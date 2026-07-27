# FixMyRoom — Cancellation Message & Completed Bookings Fix

Both items below are frontend-only — no new backend work needed.

---

## 1. Cancellation Messages Shouldn't Mention Credit for Maintenance/Routine Checkup

Maintenance and routine checkup bookings have no credit system at all — only housekeeping does. Both the **confirmation dialog** (shown before cancelling) and the **result message** (shown after cancelling) currently reference credit regardless of service type. Fix:

```js
// Confirmation dialog (before cancelling)
const confirmMessage = serviceType === 'housekeeping'
  ? "Are you sure you want to cancel this booking? The slot will become available again and your credit will be restored if cancelled more than 3 hours in advance."
  : "Are you sure you want to cancel this booking? The slot will become available again.";

// Result message (after cancelling)
let resultMessage;
if (serviceType === 'housekeeping') {
  resultMessage = creditReturned
    ? "Booking cancelled. Your credit has been returned."
    : "Booking cancelled. No credit was returned (within 3 hours of the slot).";
} else {
  // maintenance and routine_checkup — no credit system, never mention it
  resultMessage = "Booking cancelled.";
}
```

**Acceptance:** cancelling a maintenance or routine checkup booking never shows any text about credits, at either the confirmation step or the result message.

---

## 2. Routine Checkups Still Appearing in Admin Dashboard's "Completed Bookings"

The view `admin_completed_bookings_dashboard` (already live) only pulls from the `bookings` table, so a `routine_checkup` row cannot come from it — meaning this screen's query has not yet been switched over. **Action needed:** confirm the Dashboard tab's "Completed Bookings" list is querying `admin_completed_bookings_dashboard`, not whatever combined source it's currently reading from (which is where "Routine_checkup" is still leaking in).

**Acceptance:** the Completed Bookings list on the main Dashboard tab shows only `housekeeping` and `maintenance` rows — never `routine_checkup`.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Cancellation dialog/message mentions credit for maintenance | Needs frontend fix — branch by service type |
| 2 | Routine checkups in Completed Bookings list | Needs frontend fix — swap to `admin_completed_bookings_dashboard` |
