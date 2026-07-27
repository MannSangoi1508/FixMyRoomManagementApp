# FixMyRoom — Cancel Refund Logic, Activity Log Filters & Checkup Slots 406 Error

Backend SQL for this round is live and confirmed. This is what's left to build/fix on the frontend.

---

## 1. Double Booking — Should Be Fixed Now

Root cause: `validate_booking()` (the function containing the capacity check, 15-minute boundary check, and duplicate-booking check) existed but was **never actually attached as a trigger** to the `bookings` table — confirmed missing from the trigger list earlier in this project. It is now attached (`trg_validate_booking`, confirmed live). This means capacity limits (1 room/slot 9am–4pm, 3 rooms/slot 4pm–9pm for both housekeeping and maintenance) are now actually enforced at the database level for the first time.

**No frontend change needed** — retest booking the same slot twice from two accounts to confirm it now correctly blocks the second attempt.

---

## 2. Cancel Refund Logic — Root Cause Found and Fixed

There were **three different cancel functions** in the codebase (`cancel_booking`, `student_cancel_booking`, `admin_cancel_booking`) with inconsistent refund rules. `admin_cancel_booking` refunded unconditionally regardless of timing or emergency status — that's now fixed to match the same rule everywhere: refund only if housekeeping, non-emergency, and cancelled more than 3 hours before the slot.

**Frontend action needed (important, not yet done):**
- Confirm the student's own "Cancel Booking" button calls **`student_cancel_booking`** specifically — this is the most complete version (it also correctly blocks maintenance cancellation within 3 hours of the slot, which the other two functions don't handle).
- The cancellation confirmation message shown to the student must read the function's actual `credit_returned` boolean in its response and display different text accordingly. Right now it appears to show a static "credit restored" message regardless of what actually happened — that's a frontend bug independent of which function is called, and needs fixing so the message always matches reality.

---

## 3. Admin Activity Log — One Confirmed Fix, Rest Needs Frontend Investigation

**Fixed:** "Complaint Updated" filter was failing because the trigger stored `complaint_status_change` instead of `complaint_updated`. Corrected to store `complaint_updated` going forward.

**Still broken, and NOT a database issue:** `checkup_created`, `checkup_slots_cancelled`, `waitlist_created`, and `flag_removed_individual` are already stored in the database using exactly the values their filter labels would suggest — confirmed directly from the data. Notably, `flag_removed_all` (same naming pattern, same code path style) works correctly while `flag_removed_individual` doesn't, which rules out a database-side naming problem.

**Action needed:** in the Activity Log screen's filter logic, check the actual string value being sent to the query for each of these 4 specific dropdown options and compare against these exact confirmed stored values:
```
checkup_created
checkup_slots_cancelled
waitlist_created
flag_removed_individual
```
The bug is very likely a typo or mismatch in the frontend's filter-option-to-value mapping for just these four entries.

---

## 4. "Failed to Load Checkup Slots" — Root Cause Found via Console Log

The browser console showed repeated **406 errors** — this is PostgREST's signature error for a query using `.single()` (expecting exactly one matching row) when the actual query matches zero or more than one row. The failing request was filtering by `hostel=eq.H2&floor=eq.6` only — but there are multiple `routine_checkups` sessions for that same hostel/floor (Aug 1st, 2nd, 3rd, etc. all coexist). Once more than one session exists for a given hostel/floor combination, any query using `.single()` without also filtering by a specific `checkup_id` (or date) will always fail this way.

**Action needed:** find the checkup-fetch call that fires when a student taps "Book Slot" from a notification, and either:
- Add a filter on the specific `checkup_id` referenced by that notification, or
- Remove `.single()` and handle the case of multiple/zero matching rows explicitly.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Double booking | Fixed at DB level (missing trigger restored) — verify only |
| 2 | Cancel refund inconsistency | Fixed at DB level — frontend must call the right function + show accurate message |
| 3 | Activity log filters (4 of 5 remaining) | 1 fixed at DB level; other 4 confirmed to be a frontend mapping bug |
| 4 | Checkup slots 406 error | Root cause identified (`.single()` + ambiguous filter) — needs frontend fix |
