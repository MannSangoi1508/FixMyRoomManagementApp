# FixMyRoom — Routine Checkup Staff: Start Task & Door Not Opened (Still Not Fixed)

This was already specified in an earlier round and has not been implemented yet — the errors in the latest screenshots are the same underlying bugs, just with a friendlier guard message added around one of them ("task ID is missing... please refresh") rather than an actual fix. Restating with explicit code so there's no ambiguity left.

---

## 1. "Door Not Opened" — Calling a Function That No Longer Exists

**Error:** `Could not find the function public.report_door_not_opened(p_staff_id)`

The button is calling `report_door_not_opened` with only **one** parameter (`p_staff_id`). The real function requires **two**: the task/booking ID first, then the staff ID.

**Exact fix needed in the button's click handler:**
```js
// WRONG (current):
await supabase.rpc('report_door_not_opened', { p_staff_id: currentStaffId });

// CORRECT:
await supabase.rpc('report_door_not_opened', {
  p_booking_id: task.id,       // the specific task/booking's own ID
  p_staff_id: currentStaffId
});
```
This single function already handles both regular bookings and routine checkup tasks automatically — no separate function needed, just the correct two arguments.

---

## 2. "Start Task" — Task ID Not Being Read

**Error:** `Cannot start task: task ID is missing. Please refresh and try again.`

This confirms the task's ID is genuinely not present on the object being passed to the click handler — it's not a database issue, since the guard is correctly detecting a missing value before even attempting the call. This means the "Active Tasks" list is rendering task cards from data that doesn't include (or has lost) each task's `id` field.

**Action needed:** inspect the query that populates the "Active Tasks" section (likely `routine_checkup_active_tasks`, added in an earlier round) and confirm:
1. The query's `select` actually includes the task/slot's ID field.
2. Whatever maps the query results into the card components correctly passes that ID through as a prop, rather than dropping it or reading the wrong field name (e.g. `task.slot_id` vs `task.id` — the view returns it as `slot_id`, not `id`).

**Exact fix likely needed:**
```js
// If the view returns `slot_id`, but the button handler reads `task.id`:
<button onClick={() => startTask(task.slot_id)}>Start Task</button>
// not:
<button onClick={() => startTask(task.id)}>Start Task</button>
```

---

## Verification Steps

1. As routine checkup staff, open Active Tasks.
2. Tap "Start Task" on any card — should succeed with no UUID/undefined error.
3. Tap "Door Not Opened" on any card — should succeed with no "function not found" error.

If either still fails after this, please paste the exact new error text (not a screenshot description) so the specific mismatch can be pinpointed precisely.
