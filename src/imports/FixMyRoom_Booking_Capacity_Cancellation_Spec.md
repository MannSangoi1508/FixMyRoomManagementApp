# FixMyRoom — Booking Capacity, Cancellation Rules & Display Fixes: Figma Make Spec

Backend SQL for all of this is live. Everything below marked "**Needs frontend build**" has NOT been done yet and is not a backend limitation — the database fully supports it. Please implement each item as specified; if something described here already exists elsewhere in the app, point to exactly where so we can confirm it's wired to the right screen.

---

## 1. FIXED (backend): Double-Booking Was Possible

**Root cause:** the database function that checks slot availability had no capacity limit for maintenance bookings at all — it always returned "available" regardless of how many people had already booked that slot. This has been fixed. Maintenance now uses the same tiered capacity as housekeeping:
- **9am–4pm:** 1 room per 15-minute slot
- **4pm–9pm:** 3 rooms per 15-minute slot

A database-level lock has also been added so two students clicking "book" on the same slot within milliseconds of each other can't both succeed — one will now correctly get "slot fully booked."

**No frontend change needed for this specific fix** — it's enforced at the database level regardless of what the UI does. Retest: try booking the same maintenance slot twice from two different accounts.

---

## 2. NEEDS FRONTEND BUILD: Slot Availability Display Under Each Time Button

This has been requested multiple times and has not been implemented — to be direct, that's not something I can force from this side; I only provide backend functions and written specs, I can't edit your app's code directly. Below is exact, literal, copy-pasteable code so there's no ambiguity left for what to build.

**The function `get_slot_availability(service_type, date, hostel, floor)` is live and ready.** It returns one row per 15-minute slot with `booked_count` and `max_slots`.

```js
// Call when the student opens the time picker for a chosen date
const { data } = await supabase.rpc('get_slot_availability', {
  p_service_type: selectedServiceType,   // 'housekeeping' or 'maintenance'
  p_date: selectedDate,                  // 'YYYY-MM-DD'
  p_hostel: studentHostel,
  p_floor: studentFloor
});
// data = [{ time_slot: "13:00", booked_count: 0, max_slots: 1 }, ...]

// In the render for each time slot button:
const slotInfo = data.find(d => d.time_slot === buttonTimeSlot);
const isFull = slotInfo.booked_count >= slotInfo.max_slots;

<button disabled={isFull}>
  {formatTime(buttonTimeSlot)}
  <span style={{ color: isFull ? 'red' : 'green' }}>
    {slotInfo.booked_count}/{slotInfo.max_slots} rooms
  </span>
</button>
```

Matches the reference screenshot: "0/1 rooms" (green, available) or "1/1 rooms" (red, full/disabled) directly under each time button, using the tiered capacity from Item 1 (1 room 9am-4pm, 3 rooms 4pm-9pm).

**If this has already been built somewhere and just isn't visible** — reply with the exact screen/component name so we can check together instead of it silently not happening a fourth time.

---

## 3. NEEDS FRONTEND BUILD: Emergency Booking Visibility

**Corrected requirement:** the Emergency Booking option should be **hidden while the student still has their regular weekly housekeeping credit available**, and should **only appear once that credit is used** (`weekly_booking_count >= 1`). This was previously stated backwards — apologies for the confusion.

```js
const showEmergencyOption = weeklyBookingCount >= 1;
```

The backend already fully supports emergency bookings bypassing the weekly quota check regardless of when the option is shown — `check_weekly_housekeeping_limit` and `create_booking` both skip quota enforcement whenever `is_emergency = true`. This item is purely about when the button/option becomes visible to the student.

---

## 4. FIXED (backend): Cancellation & Credit Return Rules

- **Housekeeping:** credit is returned only if cancelled more than 3 hours before the slot start. Cancel option itself remains available right up until the slot starts (credit is just forfeited if cancelled late).
- **Maintenance:** cancellation is now blocked entirely within 3 hours of the slot start — no credit involved either way since maintenance never consumed one.
- **Routine checkup:** same 3-hour cutoff — cancellation blocked within 3 hours of the slot start, no credit involved.

**Frontend action needed:** hide/disable the Cancel button for maintenance and routine checkup bookings once `now() >= slot_start - 3 hours`, matching what the backend now enforces server-side. The backend will reject a late cancel attempt regardless, but the button should not invite the click in the first place.

---

## 5. FIXED (backend): Unbooked Routine Checkup Slots No Longer Appear

- **Student "Today's Schedule":** now only shows routine checkup slots that are actually booked (`is_booked = true`) for today — unbooked slots from an active checkup event no longer appear.
- **Routine Checkup Staff "Today's Checkup Queue":** same fix — `routine_checkup_queue` now only includes booked, uncompleted, non-cancelled slots for today. An unbooked slot in an otherwise-active checkup session will never show up as a task.

No frontend change needed — both screens should just query these views as before; the views themselves now filter correctly.

---

## 6. FIXED (backend): Attendance Marking Crash

Error was: `record "new" has no field "id"` — the logging trigger assumed `staff_attendance`'s primary key was named `id`, which it likely isn't (this project consistently uses names like `complaint_id`, `announcement_id`). Fixed to log the entire row generically instead of guessing a column name. Retest marking attendance — should work now, and produce an Activity Log entry.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | Double-booking (maintenance had no cap) | Fixed at DB level — verify only |
| 2 | Slot availability under time buttons | **Needs frontend build — exact code provided above** |
| 3 | Emergency booking visibility (only after credit used) | **Needs frontend build** |
| 4 | Cancellation timing + credit rules | Fixed at DB level — hide/disable buttons to match |
| 5 | Unbooked routine checkup slots hidden | Fixed at DB level — verify only |
| 6 | Attendance marking crash | Fixed at DB level — verify only |
