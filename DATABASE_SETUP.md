# Database Setup Guide

## ⚡ Quick Setup

Follow these steps to set up your Supabase database properly:

### Step 1: Open Supabase SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: **juhpvwhhxzibsaxwwgeu**
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run Initial Schema Migration

Copy and paste the entire contents of `/supabase/migrations/20260528000001_initial_schema.sql` into the SQL editor and click **Run**.

This will create:
- ✅ Users table with role-based access
- ✅ Bookings table with all booking details
- ✅ Notifications table for real-time alerts
- ✅ Emergency slots table
- ✅ Analytics logs table
- ✅ All indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Database triggers for auto-creation of profiles and notifications
- ✅ Functions for weekly reset

### Step 3: Run Seed Data Migration

Create another new query and paste the contents of `/supabase/migrations/20260528000002_seed_data.sql` into the SQL editor and click **Run**.

This will create:
- ✅ Emergency time slots for the next 7 days
- ✅ Initial analytics log entry

### Step 4: Verify Tables Created

1. Click on **Table Editor** in the left sidebar
2. You should see these tables:
   - `users`
   - `bookings`
   - `notifications`
   - `emergency_slots`
   - `analytics_logs`

### Step 5: Enable Realtime (Optional but Recommended)

1. Go to **Database** → **Replication** in the sidebar
2. Find these tables and enable realtime:
   - ✅ `bookings`
   - ✅ `notifications`

This enables automatic real-time updates across all dashboards.

## ✅ Verification

Run this query in SQL Editor to verify everything is set up correctly:

```sql
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should see:
- users (11 columns)
- bookings (16 columns)  
- notifications (6 columns)
- emergency_slots (4 columns)
- analytics_logs (3 columns)

## 🚀 Test the Application

1. Open the FixMyRoom application
2. Click **Sign Up**
3. Create a student account:
   - Name: Test Student
   - Email: student@test.edu
   - Password: password123
   - Role: Student
   - Hostel: A
   - Floor: 3
   - Room: 301

4. The account should be created successfully!
5. You'll be automatically logged in to the Student Dashboard

## 🔧 Troubleshooting

### "Failed to fetch" error during signup

**Cause**: Database tables not created yet

**Solution**: Run the SQL migrations in Supabase SQL Editor (Steps 2-3 above)

### "User profile not found" after signup

**Cause**: The trigger to auto-create user profiles isn't working

**Solution**: Check if the trigger exists:

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

You should see `on_auth_user_created` trigger on `auth.users` table.

### Cannot create bookings

**Cause**: RLS policies not applied correctly

**Solution**: Re-run the RLS policy statements from the migration file

### Notifications not appearing

**Cause**: Notification triggers not created

**Solution**: Check triggers:

```sql
SELECT * FROM information_schema.triggers
WHERE event_object_table = 'bookings';
```

You should see:
- `on_booking_created`
- `on_booking_status_changed`

## 📊 Database Schema Overview

### users table
Stores user profiles for students, staff, and admins.

**Key fields:**
- `id` - References auth.users
- `role` - student, staff, or admin
- `room_number`, `hostel`, `floor` - For students only
- `weekly_booking_count` - Tracks housekeeping bookings
- `last_reset_date` - Last time counter was reset

### bookings table
Stores all booking requests.

**Key fields:**
- `user_id` - References users.id
- `service_type` - housekeeping or maintenance
- `status` - pending, in_progress, completed, cancelled
- `assigned_staff` - Staff member handling the task
- `is_emergency` - Emergency booking flag
- `photos` - Array of photo URLs for maintenance

### notifications table
Stores notifications for users.

**Key fields:**
- `user_id` - Who receives the notification
- `type` - booking_confirmation, booking_update, etc.
- `read` - Read status
- `booking_id` - Related booking

### emergency_slots table
Stores available emergency time slots.

### analytics_logs table
Stores system events for analytics.

## 🔐 Row Level Security (RLS)

### Students can:
- ✅ View their own bookings
- ✅ Create new bookings
- ✅ Update their own bookings (for cancellation)
- ✅ View their own notifications

### Staff can:
- ✅ View assigned tasks
- ✅ View pending (unassigned) tasks
- ✅ Update task status
- ✅ View all bookings

### Admins can:
- ✅ View all users
- ✅ View all bookings
- ✅ Update any booking
- ✅ View analytics
- ✅ Reset weekly counts

## 🔄 Automatic Triggers

### 1. User Profile Creation
When a user signs up via Supabase Auth, a profile is automatically created in the `users` table with data from `user_metadata`.

### 2. Booking Confirmation Notification
When a booking is created, a confirmation notification is automatically sent to the student.

### 3. Status Change Notification
When a booking status changes, a notification is automatically sent to the student.

### 4. Updated Timestamp
Whenever a user or booking is updated, the `updated_at` field is automatically set to the current timestamp.

## 🔄 Weekly Reset Function

The `reset_weekly_booking_counts()` function can be called:

**Manually by admin:**
Via the "Reset Weekly Counts" button in Admin Dashboard

**Automatically (recommended):**
Set up a Supabase Edge Function with a cron trigger to run every Sunday at 11:59 PM:

```sql
SELECT cron.schedule(
  'reset-weekly-bookings',
  '59 23 * * 0',
  $$SELECT reset_weekly_booking_counts()$$
);
```

## 📝 Sample Data

To create test accounts, use the Sign Up form in the app:

**Student 1:**
- Email: student1@test.edu
- Password: password123
- Name: John Doe
- Role: Student
- Hostel: A, Floor: 3, Room: 301

**Student 2:**
- Email: student2@test.edu
- Password: password123  
- Name: Jane Smith
- Role: Student
- Hostel: B, Floor: 2, Room: 201

**Staff:**
- Email: staff@test.edu
- Password: password123
- Name: Mike Johnson
- Role: Maintenance/Housekeeping Staff

**Admin:**
- Email: admin@test.edu
- Password: password123
- Name: Admin User
- Role: Admin/Warden

## ✨ What's Fixed

✅ **Proper Supabase Authentication** - Email/password with automatic profile creation  
✅ **Real Database Tables** - No more KV store, using proper PostgreSQL tables  
✅ **Row Level Security** - Secure access control based on user roles  
✅ **Database Triggers** - Automatic notifications and profile creation  
✅ **Relationships** - Foreign keys between users, bookings, notifications  
✅ **Real-time Updates** - Enabled via Supabase Realtime  
✅ **Booking Validation** - Database-level checks prevent double booking  
✅ **Weekly Reset** - Database function for resetting student booking counters  
✅ **Photo Storage Ready** - Photos field ready for Supabase Storage URLs  
✅ **Analytics** - Proper aggregation queries for admin dashboard  

---

**Need Help?** Check the Supabase Dashboard logs under **Logs** → **Postgres Logs** for any errors.
