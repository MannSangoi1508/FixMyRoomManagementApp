# 🚀 FixMyRoom Setup Instructions

## ✅ What's Been Updated

### 1. UI Colors Changed
✅ **Purple → Light Blue (Sky)** - The entire UI now uses a modern light blue color scheme instead of purple

### 2. Backend Fixed
✅ **Proper Supabase Database** - Migrated from KV store to real PostgreSQL tables  
✅ **Row Level Security** - Secure access control for students, staff, and admins  
✅ **Database Triggers** - Automatic profile creation and notifications  
✅ **Real-time Updates** - Proper Supabase Realtime integration  

## 🔧 Setup Steps (One-Time Only)

### Step 1: Run Database Migrations

**You must run the SQL migrations once to create the database schema.**

#### Option A: Using Supabase Dashboard (Recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/juhpvwhhxzibsaxwwgeu)
2. Go to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of:
   ```
   /supabase/migrations/20260528000001_initial_schema.sql
   ```
5. Paste into SQL Editor and click **RUN**
6. Create another new query
7. Copy the entire contents of:
   ```
   /supabase/migrations/20260528000002_seed_data.sql
   ```
8. Paste and click **RUN**

#### Option B: Copy-Paste SQL (Fastest)

**Run this in Supabase SQL Editor:**

<details>
<summary>Click to expand complete SQL (copy everything below)</summary>

See the full SQL in `/supabase/migrations/20260528000001_initial_schema.sql`

</details>

### Step 2: Verify Database Setup

1. Go to **Table Editor** in Supabase Dashboard
2. You should see these tables:
   - ✅ users
   - ✅ bookings
   - ✅ notifications
   - ✅ emergency_slots
   - ✅ analytics_logs

### Step 3: Enable Realtime (Optional but Recommended)

1. Go to **Database** → **Replication**
2. Enable realtime for:
   - ✅ bookings
   - ✅ notifications

This enables live updates across all dashboards.

### Step 4: Test the Application

1. **Open FixMyRoom** in your browser
2. Click **"Sign Up"** tab
3. Create a test student account:

```
Name: Test Student
Email: student@test.edu
Password: password123
Role: Student
Hostel: A
Floor: 3
Room: 301
```

4. Click **"Create Account"**
5. You should be automatically logged in! ✅

## 🎯 What To Expect

### Before Database Setup:
❌ "Failed to fetch" error during signup  
❌ "User profile not found" error

### After Database Setup:
✅ Signup works perfectly  
✅ Login redirects to correct dashboard  
✅ Real-time updates work  
✅ Bookings can be created and cancelled  
✅ Notifications appear instantly  
✅ Staff can manage tasks  
✅ Admin can view analytics  

## 🔐 Test Accounts to Create

After database setup, create these accounts for full testing:

### Student 1
- Email: `student1@test.edu`
- Password: `password123`
- Name: John Doe
- Hostel: A, Floor: 3, Room: 301

### Student 2
- Email: `student2@test.edu`
- Password: `password123`
- Name: Jane Smith
- Hostel: B, Floor: 2, Room: 201

### Staff Member
- Email: `staff@test.edu`
- Password: `password123`
- Name: Mike Johnson
- Role: Maintenance/Housekeeping Staff

### Admin/Warden
- Email: `admin@test.edu`
- Password: `password123`
- Name: Admin User
- Role: Admin/Warden

## 🐛 Troubleshooting

### Issue: "Failed to fetch" during signup

**Cause:** Database tables not created yet

**Fix:** Run the SQL migrations (Step 1 above)

### Issue: "User profile not found" after signup

**Cause:** Database trigger not working

**Fix:** Verify the trigger exists:

```sql
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

If no results, re-run the initial schema migration.

### Issue: No notifications appearing

**Cause:** Notification triggers not created

**Fix:** Check triggers exist:

```sql
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'bookings';
```

You should see `on_booking_created` and `on_booking_status_changed`.

### Issue: RLS policy errors

**Cause:** Row Level Security not applied

**Fix:** Re-run the RLS policy sections from the migration file

## ✨ New Features After Setup

1. **Automatic Profile Creation**
   - When you sign up, your user profile is automatically created
   - No manual database insertion needed

2. **Automatic Notifications**
   - Booking confirmations sent instantly
   - Status updates trigger notifications
   - Admin edits notify affected users

3. **Smart Booking Validation**
   - Database prevents double bookings
   - Weekly limits enforced at database level
   - Slot availability checked in real-time

4. **Real-time Dashboard Updates**
   - All dashboards refresh every 5 seconds
   - Changes sync across all users
   - No manual refresh needed

5. **Secure Access Control**
   - Students only see their data
   - Staff only see assigned/available tasks
   - Admins see everything
   - Enforced at database level

## 📊 Database Schema

The system now uses these tables:

| Table | Purpose |
|-------|---------|
| **users** | User profiles (students, staff, admins) |
| **bookings** | All booking requests and assignments |
| **notifications** | User notifications and alerts |
| **emergency_slots** | Available emergency time windows |
| **analytics_logs** | System events for analytics |

All tables have:
- ✅ Primary keys
- ✅ Foreign key relationships
- ✅ Indexes for performance
- ✅ Row Level Security policies
- ✅ Automatic timestamps

## 🎨 UI Color Changes

All UI colors have been updated:

| Old Color | New Color |
|-----------|-----------|
| Purple | Light Blue (Sky) |
| `purple-600` | `sky-600` |
| `purple-100` | `sky-100` |
| Purple gradients | Sky gradients |

The new color scheme is:
- **Primary:** Sky Blue (#0EA5E9)
- **Light:** Sky-50 to Sky-300
- **Dark:** Sky-600 to Sky-900

## 🔄 Weekly Reset

Student booking counters reset automatically every Sunday at 11:59 PM.

**Manual Reset (Admin Only):**
Click "Reset Weekly Counts" button in Admin Dashboard

**Automatic Reset (Recommended):**
Set up Supabase Edge Function cron job:

```sql
SELECT cron.schedule(
  'reset-weekly-bookings',
  '59 23 * * 0',
  $$SELECT reset_weekly_booking_counts()$$
);
```

## 📝 Next Steps

1. ✅ Run database migrations
2. ✅ Create test accounts
3. ✅ Test booking flow
4. ✅ Test cancellation
5. ✅ Test staff task management
6. ✅ Test admin analytics
7. ✅ Verify real-time updates
8. ✅ Test weekly reset function

## 🎉 You're All Set!

Once the database is set up, the application is fully functional with:

✅ Secure authentication  
✅ Role-based dashboards  
✅ Real-time updates  
✅ Booking management  
✅ Staff task tracking  
✅ Admin analytics  
✅ Automatic notifications  
✅ Weekly counter resets  
✅ Emergency bookings  
✅ Photo uploads (ready)  

---

**Need help?** Check DATABASE_SETUP.md for detailed troubleshooting.
