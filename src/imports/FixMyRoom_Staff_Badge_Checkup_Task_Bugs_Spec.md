# FixMyRoom — Staff Announcement Badge & Routine Checkup Task Bugs

Item 1 (housekeeping refund within 3 hours) is now fully fixed at the database level — the credit column can no longer be written directly by any client, only through the backend trigger. No frontend action needed there; just verify a within-3-hour cancellation no longer returns credit.

Everything below is frontend-only.

---

## 1. Unread Announcement Badge Missing on Staff Dashboards

Confirmed by direct comparison: the student dashboard's "Announcements" tab correctly shows a red badge with an unread count (see reference screenshot). None of the three staff dashboards (housekeeping, maintenance, routine checkup) show this at all — the feature was only ever built for students.

**Fix:** on each of the 3 staff dashboards, add the same badge to the "Announcements" tab label:
```
select unread_count from unread_announcement_counts where user_id = current_staff_id
```
Show a red badge with that number next to "Announcements" if `unread_count > 0` — same visual style as the working student version. Clear it via the existing `mark_notification_read` / `mark_all_notifications_read` functions when the staff member opens the tab.

---

## 2. Routine Checkup Staff — "Door Not Opened" Calls a Deleted Function

Error shown: `Could not find the function public.report_checkup_door_not_opened(p_reported_by)`.

This function was intentionally removed earlier in this project because the original `report_door_not_opened(p_booking_id, p_staff_id)` already handles both regular bookings and routine checkup tasks in one place — it checks `bookings` first, then automatically falls back to `staff_tasks` if not found there. The frontend on this specific dashboard is still calling the old, deleted function with the wrong single parameter.

**Fix:** point the "Door Not Opened" button on the Routine Checkup staff dashboard to call:
```
report_door_not_opened(p_booking_id: <task_id>, p_staff_id: <current_staff_id>)
```
Pass the task's own ID as `p_booking_id` — the function correctly detects it's a routine checkup task and handles it accordingly, no separate function needed.

---

## 3. Routine Checkup Staff — "Start Task" Fails with `invalid input syntax for type uuid: "undefined"`

This means the task's ID isn't populated when the "Start Task" button fires — it's sending the literal string `"undefined"` instead of a real UUID. This is a frontend data-binding bug independent of which backend function is called.

**Fix:** check the "Active Tasks" list row template — confirm each task object has its `id` (or equivalent field) correctly populated from the query results, and that the click handler for "Start Task" reads that field rather than an unset/renamed variable.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Housekeeping refund within 3 hours | Fixed at DB level — verify only |
| 2 | Unread announcement badge missing for staff | Needs frontend build — view already exists |
| 3 | "Door Not Opened" calling deleted function | Needs frontend fix — use `report_door_not_opened` with correct params |
| 4 | "Start Task" undefined UUID error | Needs frontend fix — task ID not bound correctly |
