Fix all of the following completely. Do not rebuild from scratch.
1. "Could not choose best candidate function" error on booking
The error means there are TWO versions of create_booking in the database — one with p_photos and one without. The database fix has already dropped the old one. Now fix the frontend to always call create_booking with ALL parameters including p_photos, even if no photos were uploaded:
jsconst { data, error } = await supabase.rpc('create_booking', {
  p_user_id:      currentUser.id,
  p_user_name:    profile.name,
  p_room_number:  profile.room_number,
  p_hostel:       profile.hostel,
  p_floor:        profile.floor,
  p_service_type: serviceType,
  p_date:         selectedDate,
  p_time_slot:    selectedTimeSlot,
  p_notes:        notes ?? '',
  p_is_emergency: isEmergency ?? false,
  p_photos:       uploadedPhotoUrls ?? []   // always include this, even if empty array
})
if (!data?.success) {
  setError(data?.error ?? error?.message ?? 'Booking failed')
  return
}
navigate('/student/dashboard')
Find every single place in the codebase that calls create_booking or inserts directly into bookings table and replace it with this exact RPC call.
2. AuthSessionMissingError — fix auth middleware permanently
The error AuthSessionMissingError: Auth session missing at authMiddleware source/index.tsx:50 has appeared 6 times and is still not fixed. The root cause is in the backend Edge Function middleware. Fix it now:
Open source/index.tsx or wherever authMiddleware is defined. Find the line that calls supabase.auth.getUser() and fix it:
ts// WRONG — service role client cannot verify user sessions
const supabase = getSupabaseClient()  // this is service role
const { data: { user } } = await supabase.auth.getUser(token)  // always fails

// CORRECT — create a per-request client using the user's Bearer token
import { createClient } from '@supabase/supabase-js'

async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.replace('Bearer ', '')
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return c.json({ error: 'Invalid session' }, 401)
  }
  
  c.set('user', user)
  await next()
}
Also make sure the frontend Supabase singleton has NO extra config:
js// src/utils/supabase/client.ts or wherever supabase is created
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
// NO projectId, NO projectRef, NO auth overrides
3. Student upcoming bookings — completely fix this
The upcoming bookings section on the student dashboard is still not showing bookings. Fix it completely:
Step 1 — fetch both regular bookings and checkup slots:
jsuseEffect(() => {
  if (!currentUser) return
  fetchUpcomingBookings()

  // Realtime subscription so new bookings appear instantly
  const sub = supabase
    .channel('student-bookings')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'bookings',
      filter: `user_id=eq.${currentUser.id}`
    }, () => fetchUpcomingBookings())
    .subscribe()

  return () => supabase.removeChannel(sub)
}, [currentUser])

async function fetchUpcomingBookings() {
  // Regular bookings — pending and in_progress
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', currentUser.id)
    .in('status', ['pending', 'in_progress'])
    .order('date', { ascending: true })

  if (bErr) console.error('Bookings fetch error:', bErr)

  // Checkup slots booked by this student
  const { data: slots, error: sErr } = await supabase
    .from('checkup_slots')
    .select(`
      id, time_slot, is_booked, booked_by,
      routine_checkups ( id, hostel, floor, date, start_time )
    `)
    .eq('booked_by', currentUser.id)
    .eq('is_booked', true)
    .eq('is_cancelled', false)

  if (sErr) console.error('Slots fetch error:', sErr)

  // Normalize checkup slots to look like bookings for display
  const checkupItems = (slots ?? []).map(s => ({
    id: s.id,
    type: 'checkup',
    service_type: 'Routine Checkup',
    date: s.routine_checkups?.date,
    time_slot: s.time_slot,
    hostel: s.routine_checkups?.hostel,
    floor: s.routine_checkups?.floor,
    status: 'pending',
    is_checkup: true,
    checkup_id: s.routine_checkups?.id
  }))

  setUpcomingBookings([...(bookings ?? []), ...checkupItems]
    .sort((a, b) => new Date(a.date) - new Date(b.date)))
}
Step 2 — render the upcoming list:
jsx{upcomingBookings.length === 0 ? (
  <p>No upcoming bookings</p>
) : (
  upcomingBookings.map(booking => (
    <div key={booking.id} className="booking-card">
      <div>{booking.service_type}</div>
      <div>{booking.date} at {booking.time_slot}</div>
      <div>{booking.hostel} Floor {booking.floor}</div>
      <div>Status: {booking.status}</div>
      {!booking.is_checkup && (
        <CancelButton booking={booking} onCancel={fetchUpcomingBookings} />
      )}
      {booking.is_checkup && (
        <button onClick={() => cancelCheckupSlot(booking.id)}>Cancel Slot</button>
      )}
    </div>
  ))
)}
Step 3 — cancel button visibility rule:
jsfunction CancelButton({ booking, onCancel }) {
  const bookingTime = new Date(`${booking.date}T${booking.time_slot.split('-')[0]}:00`)
  const hoursUntil = (bookingTime - new Date()) / (1000 * 60 * 60)
  if (hoursUntil <= 0) return null  // hide after booking time

  async function handleCancel() {
    const { data } = await supabase.rpc('student_cancel_booking', {
      p_booking_id: booking.id,
      p_user_id:    currentUser.id
    })
    if (data?.success) {
      if (data.credit_returned) showToast('Booking cancelled. Credit returned.')
      else showToast('Booking cancelled. No credit returned (within 3 hours).')
      onCancel()
    } else {
      setError(data?.error)
    }
  }

  return (
    <div>
      <button onClick={handleCancel}>Cancel</button>
      <small>{hoursUntil > 3 ? 'Credit will be returned' : 'No credit returned'}</small>
    </div>
  )
}
4. Student completed bookings — weekly, resets every Monday 12am
jsfunction getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

async function fetchCompletedBookings() {
  const weekStart = getMonday(new Date()).toISOString()

  const { data: completed } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('status', 'completed')
    .gte('completed_at', weekStart)
    .order('completed_at', { ascending: false })

  const { data: completedSlots } = await supabase
    .from('checkup_slots')
    .select(`*, routine_checkups(hostel, floor, date)`)
    .eq('booked_by', currentUser.id)
    .eq('is_booked', true)

  // Merge and show
  setCompletedBookings([...(completed ?? []),
    ...(completedSlots ?? []).map(s => ({
      id: s.id,
      service_type: 'Routine Checkup',
      date: s.routine_checkups?.date,
      time_slot: s.time_slot,
      status: 'completed',
      is_checkup: true
    }))
  ])
}
Display as "Completed This Week: {completedBookings.length}" with a list below.
5. Staff dashboards — remove "Completed This Week" box
Remove the entire "Completed This Week" section box that shows date range, Total, and Housekeeping breakdown from ALL staff dashboards:

Housekeeping Dashboard
Maintenance Dashboard
Routine Checkup Dashboard

The only stat boxes that should remain at the top are the three cards: Pending | In Progress | Completed. These should count tasks for the current week only (since Monday 12am).
6. Staff dashboard — Pending Tasks list (today only) and Completed Tasks list (this week)
Each staff dashboard must have two separate task lists below the stat boxes:
"Pending Tasks" list — today's pending bookings only:
jsconst today = new Date().toISOString().split('T')[0]
const { data: pendingToday } = await supabase
  .from('bookings')
  .select('*')
  .eq('service_type', 'housekeeping')   // or 'maintenance'
  .in('status', ['pending', 'in_progress'])
  .eq('date', today)
  .order('time_slot', { ascending: true })
"Completed Tasks" list — all completed this week:
jsconst weekStart = getMonday(new Date()).toISOString()
const { data: completedWeek } = await supabase
  .from('bookings')
  .select('*')
  .eq('service_type', 'housekeeping')   // or 'maintenance'
  .eq('status', 'completed')
  .gte('completed_at', weekStart)
  .order('completed_at', { ascending: false })
Each task card must show: Student Name, Room Number, Hostel, Floor, Date, Time Slot, Notes, Photos.
Task action buttons:

pending → "Start Task" → update status to in_progress
in_progress → "End Task" → call complete_task RPC
completed → "Completed ✓" badge only

7. Routine checkup staff dashboard — Upcoming and Completed sections
Two sections:
"Upcoming Checkups":
jsconst { data: tasks } = await supabase
  .from('staff_tasks')
  .select('*')
  .eq('staff_type', 'routine_checkup')
  .eq('assigned_to', currentUser.id)
  .in('status', ['pending', 'in_progress'])
  .order('created_at', { ascending: true })

const { data: checkups } = await supabase
  .from('routine_checkups')
  .select(`
    id, hostel, floor, date, start_time,
    checkup_slots (
      id, time_slot, is_booked, is_cancelled,
      room_number, student_name, hostel, floor, booked_by
    )
  `)
  .gte('date', new Date().toISOString().split('T')[0])
  .order('date', { ascending: true })
"Completed Checkups" (this week):
jsconst weekStart = getMonday(new Date()).toISOString()
const { data: completedTasks } = await supabase
  .from('staff_tasks')
  .select('*')
  .eq('staff_type', 'routine_checkup')
  .eq('assigned_to', currentUser.id)
  .eq('status', 'completed')
  .gte('completed_at', weekStart)
  .order('completed_at', { ascending: false })
Each task card shows: Student Name, Room Number, Hostel, Floor, Date, Time Slot.
Task controls: Start Task → End Task (calls complete_checkup_task RPC) → Completed ✓.
8. Admin panel — routine checkup tab full details
jsconst { data: checkups } = await supabase
  .from('routine_checkups')
  .select(`
    id, hostel, floor, date, start_time, time_window,
    checkup_slots (
      id, time_slot, is_booked, is_cancelled,
      room_number, student_name, hostel, floor, booked_by
    )
  `)
  .order('date', { ascending: false })
For each checkup:

Header row: Hostel, Floor, Date, Start Time, Booked: X/32
Each booked slot: Student Name, Room Number, Hostel, Floor, Time Slot, Status, "Override" button
Override calls:

jsawait supabase.rpc('admin_cancel_checkup_slot', {
  p_slot_id:  slot.id,
  p_admin_id: currentUser.id
})
9. Photos — fix upload and display everywhere
Upload in booking form:
jsasync function uploadPhoto(file) {
  const fileName = `${currentUser.id}/${Date.now()}_${file.name}`
  const { error } = await supabase.storage
    .from('booking-photos')
    .upload(fileName, file)
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage
    .from('booking-photos')
    .getPublicUrl(fileName)
  return publicUrl
}

// Before calling create_booking:
const uploadedPhotoUrls = selectedFiles.length > 0
  ? await Promise.all(selectedFiles.map(uploadPhoto))
  : []
Display in staff task cards and admin booking details:
jsx{booking.photos?.length > 0 && (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
    <strong>Photos:</strong>
    {booking.photos.map((url, i) => (
      <img
        key={i}
        src={url}
        alt={`Photo ${i+1}`}
        onClick={() => window.open(url, '_blank')}
        style={{
          width: 80, height: 80,
          objectFit: 'cover',
          borderRadius: 6,
          cursor: 'pointer',
          border: '1px solid #ddd'
        }}
      />
    ))}
  </div>
)}
Add this photo grid to:

Housekeeping staff task cards
Maintenance staff task cards
Admin booking detail view (both upcoming and completed lists)