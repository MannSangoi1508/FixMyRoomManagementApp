# FixMyRoom — Weekly Counter Fix, Checkup Slots Error & Slot Availability: Figma Make Spec

Backend SQL for the weekly counter is done and confirmed live. This is what's left to build on the frontend.

---

## 1. Weekly Booking Badge — Swap to Live Source (Fixes "0/1 but blocked" contradiction)

**Root cause found:** the `0/1` badge was reading `users.weekly_booking_count`, a stored column that gets zeroed by the admin's "Reset Weekly Counts" button — but the actual booking gate (`check_weekly_housekeeping_limit`) counts real bookings live from the `bookings` table. These two drifted apart, so the badge could say "0/1 available" while the student was actually still blocked.

**Fix:** point the "Weekly Bookings" badge at this new view instead of `users.weekly_booking_count`:
```sql
select used_this_week, weekly_limit from student_weekly_housekeeping_status where user_id = current_user_id
```
This is now the exact same source the real gate uses, and it correctly respects the admin's reset button too (via `last_reset_date`), so that feature still works as before.

**What this does NOT change:** emergency bookings remain completely unlimited and unaffected — both the gate and this view exclude `is_emergency = true` entirely, same as always. Multiple emergency bookings after the weekly credit is used still work exactly as before.

**Acceptance:**
- [ ] Badge number always matches whether the student can actually book (no more contradictions).
- [ ] Admin's "Reset Weekly Counts" button still visibly resets the badge to 0/1 immediately.
- [ ] Emergency booking still available and unlimited once the regular credit is used.

---

## 2. "Failed to Load Checkup Slots" — Needs Frontend Investigation

This is not a database problem — confirmed no dedicated backend function exists for this; the frontend queries `checkup_slots` directly via the Supabase client, and something about that query is failing (most likely a column name mismatch, since this project has repeatedly had that exact issue with other tables). RLS is confirmed **not** the blocker — `SELECT` is allowed for all authenticated users on this table.

**Actual live columns on `checkup_slots`** (double-check the failing query against this exact list):
```
id, checkup_id, time_slot, is_booked, booked_by, created_at,
room_number, student_name, hostel, floor, cancelled_at,
is_cancelled, completed_at, door_not_opened, door_not_opened_at, reported_by
```

**Action needed:** find the exact query that runs when a student clicks "Book Slot" after the routine checkup notification, and check the browser console for the real underlying Supabase error (the generic "Failed to load checkup slots" message is likely just a catch-all wrapper hiding the real one). Compare whatever columns/filters it's using against the list above.

---

## 3. Slot Availability Display — Still Outstanding

Reminder: this was specified with exact drop-in code in an earlier round and has not yet been implemented. Restating it here since it's still missing:

```js
const { data } = await supabase.rpc('get_slot_availability', {
  p_service_type: selectedServiceType,   // 'housekeeping' or 'maintenance'
  p_date: selectedDate,                  // 'YYYY-MM-DD'
  p_hostel: studentHostel,
  p_floor: studentFloor
});
// data = [{ time_slot: "13:00", booked_count: 0, max_slots: 1 }, ...]

const slotInfo = data.find(d => d.time_slot === buttonTimeSlot);
const isFull = slotInfo.booked_count >= slotInfo.max_slots;

<button disabled={isFull}>
  {formatTime(buttonTimeSlot)}
  <span style={{ color: isFull ? 'red' : 'green' }}>
    {slotInfo.booked_count}/{slotInfo.max_slots} rooms
  </span>
</button>
```

The function `get_slot_availability` is live and already returns correct tiered capacity (1 room/slot 9am–4pm, 3 rooms/slot 4pm–9pm, same for both housekeeping and maintenance).

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Weekly badge showing wrong number | Fixed at DB level — swap the query on the frontend |
| 2 | "Failed to load checkup slots" | Needs frontend debugging — column reference provided |
| 3 | Slot availability under time buttons | Still not built — exact code restated above |
