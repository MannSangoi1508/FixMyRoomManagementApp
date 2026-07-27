# FixMyRoom — Remove Routine Checkup from Admin Dashboard Cancelled Bookings List

Pure frontend change, no backend/SQL involved. Please make this change carefully and in isolation — everything else in the app is currently working correctly, so avoid touching any other query, view, or component while making this fix.

---

## Change Needed

On the admin's main **Dashboard** tab, the **Cancelled Bookings** list currently includes `routine_checkup` entries. It should only show `housekeeping`, `maintenance`, and `emergency` cancellations — the same scope already correctly applied to that Dashboard's **Completed Bookings** list in an earlier fix.

Routine checkup cancellations should remain visible only in the **Routine Checkups** tab (where they already display correctly under each event's "Cancelled Slots" section) — not duplicated on the main Dashboard.

**Fix:** find the query that populates the Cancelled Bookings list on the Dashboard tab specifically, and exclude `service_type = 'routine_checkup'` from it (e.g. add a `.neq('service_type', 'routine_checkup')` filter, or equivalent, matching however the Completed Bookings list was scoped previously).

---

## Scope Warning

This is a single, isolated query change on one specific list. Please do not modify:
- The Routine Checkups tab or any of its views/functions (Waitlist, Schedule Checkup, Cancel Slots, etc.) — all confirmed working.
- The Completed Bookings list on the Dashboard (already correctly scoped).
- Any other dashboard, booking, credit, or notification logic — all confirmed working as of this round.

---

## Verification

- Cancel a routine checkup slot as a student (or via admin "Cancel Slots").
- Confirm it does **not** appear in the admin Dashboard's Cancelled Bookings list.
- Confirm it **does** still appear correctly under the relevant event's "Cancelled Slots" section in the Routine Checkups tab.
- Confirm cancelling a housekeeping or maintenance booking still appears in the Dashboard's Cancelled Bookings list as before (unaffected).
