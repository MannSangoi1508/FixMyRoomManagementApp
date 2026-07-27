# FixMyRoom — Credit Refund Fixed for Real + Admin Slot Count Input

Backend fix for the credit refund bug is live and addresses the actual root cause this time. This is what's left to build/verify on the frontend.

---

## 1. Credit Refund Within 3 Hours — Real Root Cause Found and Fixed

Previous rounds correctly proved `weekly_booking_count` itself never changed on a within-3-hours cancellation — that part was always right. The actual bug was one level deeper: the **eligibility check** (`check_weekly_housekeeping_limit`) counted a booking as "used" only while its status wasn't `cancelled` — so the moment any cancellation happened (refunded or not), it silently dropped out of that count and let the student book again immediately, even without a real refund.

Both `check_weekly_housekeeping_limit` and the `student_weekly_housekeeping_status` view now apply the same rule consistently: a cancellation only frees up the weekly slot if it was cancelled more than 3 hours before the booking's start time — matching the exact rule the refund trigger itself uses. A within-3-hours cancellation now correctly keeps the student blocked from booking again that week.

**No frontend change needed** — verify: book a housekeeping slot, cancel it within 3 hours, then try to book again immediately. The second attempt should now be correctly blocked ("You have already used your 1 housekeeping booking this week"), and the badge should reflect this consistently.

---

## 2. New Feature: Admin Chooses Number of Slots When Scheduling a Checkup

Backend already supports any slot count (via `generate_checkup_slots_dynamic` / `generate_checkup_slots_custom`) — the 32-slot default was always just a frontend choice, not a backend limit.

**Build:** add a "Number of Slots" input field to the "Schedule Routine Checkup" form, alongside Hostel, Floor, Date, Start Time, and Time Per Slot. Pass this value through to whichever slot-generation call the form currently makes, replacing the hardcoded 32.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Credit refund / re-booking after within-3-hours cancel | Fixed at DB level — verify only |
| 2 | Admin-configurable slot count | New feature — needs frontend input field |
