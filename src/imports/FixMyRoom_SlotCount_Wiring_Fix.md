# FixMyRoom — Slot Count Still Not Applied: Frontend Must Call the 4-Argument Function

Root cause confirmed via direct database check: **two versions of `generate_checkup_slots_custom` exist** —

- `generate_checkup_slots_custom(uuid, text, integer)` — the original, hardcoded to always create 32 slots regardless of input.
- `generate_checkup_slots_custom(uuid, text, integer, integer)` — the fixed version from an earlier round, which accepts a 4th argument (`p_slot_count`) and creates exactly that many slots.

The "Number of Slots" field on the Schedule Checkup form exists and the admin can type a value into it, but **the actual booking submission is still calling the 3-argument version** — which has no slot-count parameter at all, so whatever the admin typed is silently discarded and 32 slots get created every time regardless.

**Fix needed:** wherever the Schedule Checkup form submits, change the call to explicitly pass all 4 arguments, including the slot count value from the input field:
```
generate_checkup_slots_custom(
  p_checkup_id: <the new event's id>,
  p_start_time: <start time>,
  p_slot_duration: <minutes per slot>,
  p_slot_count: <value from the "Number of Slots" input>
)
```

**Verify:** create a routine checkup event specifying 16 slots — the resulting event should show "0/16 slots booked" (not 32), and the student booking screen for that event should show exactly 16 time slots to choose from.
