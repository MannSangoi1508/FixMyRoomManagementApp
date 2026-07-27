# Figma Make Prompt — service_type & time_slot Null Fix

Paste everything below this line into Figma Make AI chat:

---

The booking form is submitting with `service_type = null` and `time_slot = null` even when the user selects them. This is a critical bug. Fix it as follows:

## 1. Add debug logs before insert
Add these console logs immediately before the Supabase insert to confirm what values are being sent:

```js
console.log('service_type:', serviceType)
console.log('time_slot:', selectedTimeSlot)
console.log('full booking object:', bookingData)
```

## 2. Fix the insert object
The insert object must use exactly these field names with underscores — not hyphens, not camelCase:

```js
{
  user_id: user.id,
  user_name: profile.name,
  room_number: profile.room_number,
  hostel: profile.hostel,
  floor: profile.floor,
  service_type: serviceType,
  date: selectedDate,
  time_slot: selectedTimeSlot,
  notes: notes ?? '',
  is_emergency: false,
  status: 'pending',
  assigned_staff: null,
  assigned_staff_name: 'Pending Assignment'
}
```

## 3. Fix the service type dropdown
The service type dropdown onChange handler must update state immediately. Check that the dropdown `value` prop is bound to the state and `onChange` calls `setServiceType(value)` correctly. If the dropdown uses a custom component, make sure the selected value is being passed back up to the parent form state.

## 4. Fix the time slot selector
The time slot selector must update state via `setSelectedTimeSlot(value)` when a slot is tapped or selected. If it is a custom slot picker component, make sure the selected slot value is passed back to the parent form state before the submit button is enabled.

## 5. Add form validation before submit
Block the form submit button and show a validation error if either `service_type` or `time_slot` is null or empty when the user tries to submit. Do not allow the insert to reach Supabase with null values:

```js
if (!serviceType || !selectedTimeSlot) {
  setError('Please select a service type and time slot before submitting.')
  return
}
```
