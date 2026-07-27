# FixMyRoom — Update Spec v2 (matched to real schema)

Pair with `fixmyroom_updates_v2.sql`. Run the SQL first, then rebuild these screens/flows in Figma Make.

**Key discovery:** Routine checkups are NOT stored in the `bookings` table — they live entirely in `checkup_slots` (individual room slots, 224 live rows) + `routine_checkups` (the parent event: hostel/floor/date/time window). Housekeeping, maintenance, and emergency requests all live together in `bookings` (27 live rows), distinguished by `service_type` and `is_emergency`. Treat these as two separate systems in your rebuild — several bugs exist specifically because the app was mixing them up.

---

## 1. Staff Dashboard — "Door Not Opened" = Completed

**Housekeeping/Maintenance/Emergency (via `bookings`):** Call `report_door_not_opened(booking_id, student_id, reported_by)`. This logs the report and marks the booking `completed` in one step — it will disappear from the staff's active list automatically.

**Routine Checkup (via `checkup_slots`):** Call `report_checkup_door_not_opened(slot_id, reported_by)` instead — a different function, because routine checkups don't have rows in `bookings` at all. **This is also the fix for the "Booking not found" bug (see Section 7)** — the app was very likely trying to validate the slot against `bookings`, where it could never exist.

**Acceptance:**
- [ ] Confirming "Door Not Opened" on either flow removes the item from the active list immediately.
- [ ] Completed list shows a distinct "Door Not Opened" tag (query `room_task_history_view.display_status` or check `checkup_slots.door_not_opened`).

---

## 2. Admin — Booking Type Visibility

Already supported by existing columns: `bookings.service_type` (`housekeeping`/`maintenance`) + `bookings.is_emergency` (boolean). This is a **frontend-only fix** — just render a badge using these two fields (e.g., if `is_emergency = true`, show "Emergency" regardless of `service_type`).

---

## 3. Student Dashboard — Today-Only Schedule

Query the new view `student_today_schedule` (combines today's `bookings` + today's unfinished `checkup_slots`). Replace whatever query currently powers this widget.

---

## 4. Complaints & Announcements — Schema Errors

- `complaints` was missing `room_number` — now added. Update your complaint submission form to actually send it.
- `announcements` already had `content`, `title`, `admin_id`, and all four target booleans — **the `content` error was likely a stale schema cache, not a missing column.** The `created_by` error is now fixed with a generated column that mirrors `admin_id`, so you can leave the frontend as-is or switch it to `admin_id` — either works.
- After running the SQL: Supabase → Settings → API → **Reload schema**.

---

## 5. Admin — Targeted Announcements (Checkboxes)

**Already fully supported in your schema** — `target_students`, `target_housekeeping`, `target_maintenance`, `target_routine_checkup` all exist as booleans. This is a **frontend-only build**: 4 checkboxes bound to these 4 columns, at least one required (DB now enforces this with a constraint, so a bad submit will error clearly instead of silently succeeding with no audience).

---

## 6. Room History — Cancellation Source & Door Not Opened

Query the new `room_task_history_view` instead of the raw `room_task_history` table — it resolves `display_status` to one of: `Completed`, `Door Not Opened`, `Cancelled by Student`, `Cancelled by Admin`.

**Important fix underneath:** `room_task_history.booking_ref` was an integer column trying to reference `bookings.id`, which is a UUID — it could never have worked. Two new proper UUID columns were added: `booking_id` (for housekeeping/maintenance/emergency) and `checkup_slot_id` (for routine checkups). Update whatever writes to `room_task_history` to populate the correct one of these two, and also set `cancelled_by` (`'student'` or `'admin'`) when a cancellation happens.

---

## 7. Routine Checkup Staff — "Booking Not Found" Bug

**Root cause confirmed:** `door_not_opened_reports` only has a foreign key to `bookings.id`. Routine checkup slots live in `checkup_slots` — a completely different ID space — so a lookup against `bookings` for a checkup slot ID will always come back empty.

**Fix:** Routine checkup staff's "Door Not Opened" button must call `report_checkup_door_not_opened(slot_id, reported_by)`, **not** whatever function/query is being used for the `bookings`-based flow. Make sure the frontend uses two separate code paths depending on whether it's showing a `bookings` row or a `checkup_slots` row.

---

## 8. Student Rules & Regulations — Copy Change

Change:
> "Cancel bookings before start time to restore credits"

To:
> "Cancel bookings 3 hours before start time to restore credits"

Text-only change. (Worth double-checking your cancellation function actually enforces a 3-hour cutoff server-side, since the old copy didn't mention one — flag if it doesn't yet.)

---

## 9. Admin Schedule Overview — Scope

Query the new `admin_schedule_overview` view — covers pending/in-progress items (any date) from both `bookings` and `checkup_slots`, plus anything completed **today**. Nothing older shows here; that lives in Room History.

---

## 10. Admin Activity Log — Rebuilt

Good news: `admin_activity_log` table already existed with sensible columns (`admin_id`, `action_type`, `description`, `metadata`, `performed_at`) — **nothing was ever writing to it.** Triggers now auto-log on: booking status changes, complaint submissions/status changes, and announcement sends. Point your Admin Activity Log screen at this table, sorted by `performed_at desc`.

---

## 11. Data Retention — 7-Day Auto-Expiry

`pg_cron` is enabled on your project, so this runs automatically — a daily job at 3am deletes `notifications` and `announcements` older than 7 days. No frontend change needed; verify by checking `select * from cron.job;` in the SQL editor to confirm the job is scheduled.

---

## 12. Routine Checkup Staff — Chronological Auto-Advancing Queue

This is the fix for your screenshot specifically. Two things were wrong at once:
1. **No date filtering at all** — a checkup from a month ago (June 10) had no reason to ever leave the list, whether or not it was completed.
2. **No single ordered queue** — slots weren't being surfaced one-at-a-time by time.

**Fix:** Rebuild this screen around `routine_checkup_queue` — it already joins `checkup_slots` to its parent `routine_checkups` event to get the real date, filters to **today only**, excludes anything completed/cancelled/door-not-opened, and orders by `time_slot` ascending. Show only the top row prominently ("Next: Room 604") with the rest collapsed as a count. When staff completes or marks door-not-opened, re-query the view — the row disappears and the next one becomes top automatically, no manual logic needed on the frontend.

For the separate "Upcoming Checkups" event-level list (the card view in your screenshot, showing "X/32 booked" per event), switch it to `routine_checkup_events_upcoming` — this filters to `date >= current_date` at the database level, so a month-old event can never appear again regardless of its completion state.

**Note on staff assignment:** `routine_checkup_queue` also joins `staff_tasks` to get `assigned_to`, since that's how staff-to-checkup assignment is modeled in your schema. With only one active routine checkup staff member right now this won't visibly change anything, but once you add more staff, filter the query by `assigned_to = current_staff_id` and it'll scope correctly without further schema changes.

---

## Summary — What Actually Needed a Database Change vs. Just Frontend

| # | Area | Real fix type |
|---|------|----------------|
| 1 | Door not opened → completed | New DB functions (2 — bookings vs checkup_slots) |
| 2 | Booking type badge | Frontend only |
| 3 | Today-only student schedule | New view, swap query |
| 4 | Complaints/announcements errors | 1 real column added + reload cache |
| 5 | Targeted announcements | Frontend only (columns already existed) |
| 6 | Room history cancel/door source | New columns + view (old link was broken) |
| 7 | "Booking not found" | Root cause = wrong table lookup; use new function |
| 8 | Rules text | Copy only |
| 9 | Admin schedule scope | New view, swap query |
| 10 | Activity log | New triggers (table already existed) |
| 11 | 7-day auto-expiry | Scheduled job (pg_cron) |
| 12 | Chronological queue + stale event bug | New views (queue + date-filtered events) |