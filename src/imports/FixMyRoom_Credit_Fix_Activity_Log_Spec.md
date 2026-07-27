# FixMyRoom — Booking Credit Fix, Slot Availability & Activity Log: Figma Make Spec

Backend for all of this is now live. This is what's left to build/rewire on the frontend.

---

## 1. Weekly Credit — Root Cause Was Duplicate Functions, Now Fixed

Your app already had a complete, correct set of booking functions (`create_booking`, `student_cancel_booking`, `validate_booking` trigger, etc.) before we started. Some of my earlier fixes accidentally created **duplicate versions** of these that ran alongside the originals, causing the credit to increment 2-3 times per booking. All duplicates have been removed; the original functions are now fixed in place and are the single source of truth.

Everyone's `weekly_booking_count` has also been resynced to the correct value based on actual bookings this week — no frontend change needed, but verify: book a housekeeping slot, confirm the count goes from 0/1 → 1/1, book an emergency slot after, confirm it stays at 1/1.

---

## 2. False "You'll Lose Your Credit" Alert — Fixed

Root cause: the actual `cancel_booking` function the app calls had no 3-hour or emergency check at all — it refunded unconditionally regardless of what the UI warned. Now fixed to only refund when: housekeeping, not emergency, and cancelled more than 3 hours before the slot. Retest a within-3-hours cancellation and confirm the credit is **not** returned this time.

---

## 3. Admin Schedule Overview — Still Needs the Actual Swap

This one hasn't been touched yet on the frontend despite earlier instructions. **Action needed:** find wherever the "Schedule Overview" tab currently queries data and point it at the `admin_schedule_overview` view instead of its current source. If the screen has hardcoded filters defaulting to something too narrow (e.g. only "today," only "pending"), remove those defaults so the view's own logic controls what's shown.

---

## 4. Routine Checkup Booked Count Not Updating on Admin Panel

The backend data is correct — `book_checkup_slot()` properly sets `is_booked = true`, `booked_by`, `room_number`, etc. on the `checkup_slots` row when a student books. The `routine_checkup_events_upcoming` view (already live) correctly aggregates this into `booked_slots`/`total_slots`.

**This means the "0/32" you're seeing is a frontend binding issue** — the Scheduled Checkups list is very likely reading a different field (or a stale/cached query) instead of `booked_slots` from that view. **Action needed:** re-verify the "X/32 slots booked" badge on this screen is bound to `booked_slots` / `total_slots` from `routine_checkup_events_upcoming`, and that the screen re-fetches after a booking happens rather than showing a cached count from page load.

---

## 5. New Feature: Slot Availability Display on Booking Form

Matches the reference screenshot (1 room/slot from 1–4pm, 3 rooms/slot from 4–9pm for housekeeping; maintenance shown as unlimited). Call the new `get_slot_availability(service_type, date, hostel, floor)` function — it returns one row per 15-minute slot with `time_slot`, `booked_count`, and `max_slots` (null for maintenance, meaning no cap).

**Build:** on the student's "New Booking" screen, once they've picked a date/service, call this function and render each slot as a card — green/available if `booked_count < max_slots`, greyed out/red if full, showing `booked_count/max_slots` (or just "available" for maintenance, since it has no cap). This should replace or match whatever's currently generating Image 4's grid.

---

## 6. Complaint Follow-Ups — Close on Resolution + Split Lists

Two changes to the student's "My Complaints & Feedback" screen:
- **Hide the follow-up comment box** once a complaint's `status = 'resolved'` (or `'closed'` if you use that value too) — no new column needed, just check `status` before rendering the input.
- **Split into two sections:** "Unresolved" (status in `received`, `reviewed`) shown first, then "Resolved" (status = `resolved`) below it. This lets admins/students see at a glance how many issues are still open vs. closed. A simple client-side filter on the existing `status` field is enough — no new query needed beyond what already powers this list.

---

## 7. Admin Activity Log — Root Cause Found: Missing RLS Policy

The table had Row Level Security enabled with **no policy at all**, which silently blocks all reads for the app's logged-in admin even though rows were being written correctly by the triggers. A policy has been added allowing any user with `role = 'admin'` to read this table. No frontend change needed — just retest; entries should now appear.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Weekly credit double/triple counting | Root cause fixed (duplicate functions removed) — verify only |
| 2 | False refund alert | Fixed at DB level — verify only |
| 3 | Admin schedule overview not updating | **Needs actual frontend swap — not yet done** |
| 4 | Checkup booked count showing 0/32 | Backend confirmed correct — frontend binding fix needed |
| 5 | Slot availability display | New function ready — needs frontend build |
| 6 | Complaint resolved/unresolved split + close comments | Frontend-only, uses existing `status` field |
| 7 | Activity log empty | Fixed (missing RLS policy) — verify only |
