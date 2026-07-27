# Figma Make Prompt — Bug Fixes

Paste everything below this line into Figma Make AI chat:

---

Fix the following bugs. Do not rebuild anything from scratch, only fix what is broken.

## 1. service_type null error on booking
The booking insert fails with "null value in column service_type violates not-null constraint". The field name in the form may be using a hyphen `service-type` instead of an underscore `service_type`. Find every place the booking form builds the insert object and make sure the field is named exactly `service_type` with an underscore. Also ensure the value is being read correctly from the form dropdown before insert — add a console log before the insert to confirm service_type is not null or undefined before submitting.

## 2. Emergency slots — only show if weekly booking is exhausted
Emergency booking section should only be visible to the student when their `weekly_booking_count` in the `users` table equals 1 (meaning they have used their 1 normal booking). If `weekly_booking_count` is 0, hide the emergency booking option entirely and show a message like "Use your weekly booking first before accessing emergency slots". Also filter emergency slots shown to only those where `is_available = true` AND the slot time has not already passed — compare the slot date and start time against the current date and time and hide expired slots.

## 3. Admin cancel/override booking
The cancel booking button in admin dashboard is not working. Replace the current cancel logic entirely with a call to the Supabase RPC function `admin_cancel_booking` like this:

```js
const { data, error } = await supabase.rpc('admin_cancel_booking', {
  p_booking_id: booking.id,
  p_admin_id: currentUser.id
})
if (data?.success) {
  // refresh booking list
}
```

After a successful cancel, immediately refresh the bookings list so the cancelled booking updates its status to 'cancelled' in the UI.

## 4. Project ID warning on login
On login with correct credentials, a warning "project id not defined" flashes before logging in. Find where the Supabase client is initialised (likely in `/utils/supabase/info.ts` or similar) and make sure `projectId` is either correctly set from the environment variable or removed from the client config if it is not needed. The warning is caused by passing `undefined` as the project ID — either supply it or remove that parameter entirely.

## 5. Booking details missing from dashboards
Bookings are saved but show up without details (student name, room number, hostel, floor, date, time slot, service type) in the admin and staff dashboards. The booking insert is missing these fields. Make sure every booking insert includes all of these fields explicitly:

```js
{
  user_id: user.id,
  user_name: profile.name,
  room_number: profile.room_number,
  hostel: profile.hostel,
  floor: profile.floor,
  service_type: serviceType,   // must be 'housekeeping' or 'maintenance'
  date: selectedDate,
  time_slot: selectedSlot,
  notes: notes ?? '',
  is_emergency: isEmergency,
  status: 'pending',
  assigned_staff: null,
  assigned_staff_name: 'Pending Assignment'
}
```

In admin and staff dashboards, make sure the booking list displays all these columns: student name, room number, hostel, floor, date, time slot, service type, status.

## 6. Routine checkup slot generation JSON error
The error "Unexpected non-whitespace character after JSON at position 4" means the app is trying to pass the slot array as a raw JSON string but it is malformed. Replace the slot generation logic entirely — do not build a JSON array manually. Instead, after creating the checkup record, call the Supabase RPC function `generate_checkup_slots` like this:

```js
// First insert the checkup
const { data: checkup } = await supabase
  .from('routine_checkups')
  .insert({
    hostel,
    floor,
    date,
    start_time: startTime,
    time_window: startTime + '-' + endTime,
    service_type: 'maintenance',
    created_by: currentUser.id
  })
  .select()
  .single()

// Then generate all 32 slots via RPC
await supabase.rpc('generate_checkup_slots', {
  p_checkup_id: checkup.id,
  p_start_time: startTime
})
```

Do not pass slots as a JSON array anywhere. The RPC function handles all 32 slot insertions on the database side.
