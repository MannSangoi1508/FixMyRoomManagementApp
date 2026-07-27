# FixMyRoom — Routine Checkup Task ID Wiring

Backend is now fully in place and confirmed working: `staff_tasks` has a proper `checkup_slot_id` link, and both `routine_checkup_active_tasks` and `routine_checkup_queue` now expose a real `task_id` field alongside the existing `slot_id`.

---

## 1. Start Task

Point the "Start Task" button at the new function, using `task_id` (not `slot_id`) from the Active Tasks / Queue row:

```js
await supabase.rpc('start_checkup_task', { p_task_id: task.task_id });
```

If `task.task_id` is ever `null` for a given row (possible if a staff member wasn't available when the slot was originally booked, so no task was created), disable the Start Task button for that row and show something like "No staff task linked yet" rather than sending a null ID.

---

## 2. Door Not Opened

Same pattern — use `task_id`, and pass both required arguments:

```js
await supabase.rpc('report_door_not_opened', {
  p_booking_id: task.task_id,   // yes, this param is named p_booking_id but accepts either a booking or task ID — the function auto-detects which
  p_staff_id: currentStaffId
});
```

---

## 3. Housekeeping Booking — Still Need Current Error

The `validate_booking` trigger is confirmed `SECURITY DEFINER` (fixed), but we never got the exact error text after that fix was applied — it's unclear whether booking now works, or whether a new/different error appears. **Before this can be marked resolved:** try booking a housekeeping slot again and paste the exact error text shown (if any) — not a description, the literal message — so we're not guessing at what's actually happening now.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Start Task button | Backend ready — needs frontend to use `task_id` field |
| 2 | Door Not Opened button | Backend ready — needs frontend to use `task_id` field |
| 3 | Housekeeping booking | Status unconfirmed — need current exact error text to proceed |
