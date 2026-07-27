# FixMyRoom — CRITICAL: Build Error + Unified Routine Checkup Booking Screen

## 0. CRITICAL — Fix This First: App Build Is Broken

Console shows a build failure blocking the entire app, not a runtime bug:
```
[esbuild] Build error: Error1: Build failed with 2 errors:
virtual-fs:file:///src/app/components/AdminDashboard.tsx:2:26: ERROR: Could not resolve "/utils/supabase/info"
virtual-fs:file:///src/app/supabaseClient.ts:2:41: ERROR: Could not resolve "/utils/supabase/info"
```

Both `AdminDashboard.tsx` and `supabaseClient.ts` import a file at `/utils/supabase/info` that no longer exists at that path (likely moved, renamed, or deleted in a recent change). **Until this is fixed, the app is not running properly-compiled code**, which likely explains the "Failed to book slot" error and other odd/inconsistent behavior — a broken build can cause cascading failures that look unrelated to the actual bug.

**Action needed:** locate `/utils/supabase/info` (or wherever it was moved to) and fix the import path in both files. Please resolve this before testing anything else in this document or re-verifying the backend fixes from the previous round — a broken build will make working backend logic appear broken.

---

## 1. Three Booking Entry Points, One Shared Booking Screen

**Correction to a previous round's instruction:** do NOT remove the booking option from the Notifications tab. All three of the following should remain as valid ways for a student to discover and start booking a routine checkup slot:

1. The **"Routine Checkup" card** on the main student dashboard (the newer direct-booking option).
2. The **dashboard pop-up** that appears when a new checkup opens.
3. The **Notifications tab** entry for that checkup.

**What needs to change:** right now these three entry points appear to use different/duplicated booking implementations (which is likely why booking works from the pop-up/notification path but fails from the Routine Checkup card). Instead, **all three should open the exact same single booking screen/component** — same time-slot grid, same booking logic, same call to `book_checkup_slot`. Think of it as one booking screen with three different doors into it, not three separate booking screens.

**This also means:** when a waitlisted student is notified about a newly opened slot (via `admin_schedule_waitlist_session`), that slot must correctly appear and be bookable from **all three** entry points consistently — the Routine Checkup card, the pop-up, and the Notifications tab — not just one of them.

**Acceptance criteria:**
- [ ] Booking via the Routine Checkup card works (currently broken — likely tied to the build error in Item 0, retest after that's fixed).
- [ ] Booking via the pop-up works (already confirmed working).
- [ ] Booking via the Notifications tab works (already confirmed working).
- [ ] All three, for the same checkup event, show the identical set of available slots — no discrepancies between entry points.
- [ ] A newly-opened waitlist session slot is visible and bookable from all three places, not just one.

---

## 2. Reschedule/Cancel — Fix Both Buttons Clearly

Two distinct problems reported with the reschedule/cancel modal:

**A. Clicking outside the modal incorrectly cancels the booking.** This is unintended data loss from what should be a neutral dismiss action.
- **Fix:** clicking outside the modal (or pressing Escape) must do nothing — just close the modal with no changes made.
- Add an explicit "X" or "Close" button inside the modal that also closes it with no changes.
- The actual "Cancel Booking" action must only fire from its own explicit, clearly-labeled button — never from an accidental outside click.

**B. "Reschedule" and "Cancel" should be two distinct, clearly separated actions**, not conflated:
- **Reschedule** = cancel the current slot AND immediately show the booking screen (from Item 1) so the student can pick a new one in the same flow.
- **Cancel** = cancel the current slot only, with no follow-up booking prompt — the student can come back later via any of the 3 entry points from Item 1 to book again whenever they choose.
- Both should use the same underlying `cancel_checkup_slot` call; they differ only in whether the booking screen opens immediately afterward.

**Acceptance criteria:**
- [ ] Clicking outside the modal never cancels a booking.
- [ ] "Reschedule" cancels + immediately opens the shared booking screen.
- [ ] "Cancel" cancels only, no forced follow-up.
- [ ] After either action, the slot correctly disappears from the student's own bookings and correctly reappears as available in the shared booking screen for rebooking (backend already fixed for this in the previous round — retest once Item 0's build error is resolved).

---

## Notes

- The credit-refund-within-3-hours concern is still being revisited after these routine checkup items are confirmed stable, per earlier prioritization — not forgotten.
- Please retest everything in this document only after Item 0 (build error) is resolved — errors seen before that fix may not reflect the true state of the backend logic.

---

## Summary

| # | Item | Status |
|---|------|--------|
| 0 | App build broken (bad import path) | **Blocking — must fix before anything else can be verified** |
| 1 | Three booking entry points → one shared booking screen | Needs frontend consolidation (keep all 3 entry points) |
| 2 | Modal click-outside cancels + Reschedule vs Cancel clarity | Needs frontend fix |
