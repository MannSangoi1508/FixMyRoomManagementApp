# ✅ Setup Checklist

Follow this checklist to get FixMyRoom running:

## 📋 One-Time Database Setup

### Step 1: Open Supabase Dashboard
- [ ] Go to https://supabase.com/dashboard
- [ ] Select project: `juhpvwhhxzibsaxwwgeu`
- [ ] Click **SQL Editor** in sidebar

### Step 2: Run Schema Migration
- [ ] Click **New Query**
- [ ] Copy entire contents of `/supabase/migrations/20260528000001_initial_schema.sql`
- [ ] Paste into SQL Editor
- [ ] Click **RUN**
- [ ] Wait for success message

### Step 3: Run Seed Data
- [ ] Click **New Query** again
- [ ] Copy entire contents of `/supabase/migrations/20260528000002_seed_data.sql`
- [ ] Paste into SQL Editor
- [ ] Click **RUN**
- [ ] Wait for success message

### Step 4: Verify Tables Created
- [ ] Click **Table Editor** in sidebar
- [ ] Verify these tables exist:
  - [ ] users
  - [ ] bookings
  - [ ] notifications
  - [ ] emergency_slots
  - [ ] analytics_logs

### Step 5: Enable Realtime (Optional)
- [ ] Go to **Database** → **Replication**
- [ ] Enable realtime for `bookings` table
- [ ] Enable realtime for `notifications` table

## 🎯 Test the Application

### Create Test Student Account
- [ ] Open FixMyRoom app
- [ ] Click **Sign Up** tab
- [ ] Fill in:
  - Name: `Test Student`
  - Email: `student@test.edu`
  - Password: `password123`
  - Role: `Student`
  - Hostel: `A`
  - Floor: `3`
  - Room: `301`
- [ ] Click **Create Account**
- [ ] Verify you're logged in to Student Dashboard

### Create Booking
- [ ] Click **New Booking** button
- [ ] Select **Housekeeping** or **Maintenance**
- [ ] Choose today's date
- [ ] Select a time slot
- [ ] Add notes (optional)
- [ ] Click **Create Booking**
- [ ] Verify booking appears in "Upcoming Bookings"

### Test Cancellation
- [ ] Find the booking you just created
- [ ] Click **Cancel Booking** (red button)
- [ ] Click **Yes, Cancel Booking** in popup
- [ ] Verify booking status changes to "Cancelled"
- [ ] Verify weekly credit is restored (if housekeeping)

### Create Staff Account
- [ ] Sign out from student account
- [ ] Click **Sign Up** tab
- [ ] Fill in:
  - Name: `Test Staff`
  - Email: `staff@test.edu`
  - Password: `password123`
  - Role: `Maintenance/Housekeeping Staff`
- [ ] Click **Create Account**
- [ ] Verify you're logged in to Staff Dashboard

### Test Task Management (as Staff)
- [ ] Sign in as student again
- [ ] Create a new booking
- [ ] Sign out and sign in as staff
- [ ] Verify the booking appears in "Pending" tasks
- [ ] Click **Start Task**
- [ ] Verify task moves to "In Progress"
- [ ] Click **Mark Complete**
- [ ] Verify task moves to "Completed"

### Create Admin Account
- [ ] Sign out from staff account
- [ ] Click **Sign Up** tab
- [ ] Fill in:
  - Name: `Test Admin`
  - Email: `admin@test.edu`
  - Password: `password123`
  - Role: `Admin/Warden`
- [ ] Click **Create Account**
- [ ] Verify you're logged in to Admin Dashboard

### Test Admin Features
- [ ] Verify analytics show correct numbers
- [ ] Click **Analytics** tab
- [ ] Verify hostel and floor statistics
- [ ] Click **Schedule Overview** tab
- [ ] Verify all bookings are visible
- [ ] Test filters (hostel, floor, service, date)
- [ ] Click **Reset Weekly Counts** button
- [ ] Verify success message

## ✅ Verification Checklist

### Database Setup Complete
- [ ] All 5 tables exist in Table Editor
- [ ] SQL migrations ran without errors
- [ ] Emergency slots created for next 7 days

### Authentication Working
- [ ] Student signup works
- [ ] Staff signup works
- [ ] Admin signup works
- [ ] Login works for all roles
- [ ] Profile fetch works after login

### Student Features Working
- [ ] Can create housekeeping booking
- [ ] Can create maintenance booking
- [ ] Can cancel booking before start time
- [ ] Cannot cancel after start time
- [ ] Weekly limit enforced (1 housekeeping/week)
- [ ] Notifications appear
- [ ] Schedule overview accessible

### Staff Features Working
- [ ] Can view pending tasks
- [ ] Can start task (auto-assigns)
- [ ] Can mark task complete
- [ ] Can filter tasks
- [ ] Can access schedule overview

### Admin Features Working
- [ ] Can view all bookings
- [ ] Can view all users
- [ ] Can view analytics
- [ ] Can reset weekly counts
- [ ] Can access schedule overview
- [ ] Can see flagged students (if any)

### Real-time Updates Working
- [ ] New bookings appear within 5 seconds
- [ ] Status changes sync across dashboards
- [ ] Notifications appear in real-time
- [ ] Cancellations update all views

## 🎨 UI Updates Verified
- [ ] Login page is light blue (not purple)
- [ ] Dashboard headers are light blue
- [ ] Buttons are light blue gradients
- [ ] All purple colors replaced with sky blue

## 🐛 If Something's Not Working

### "Failed to fetch" error
➡️ Database not set up. Run SQL migrations (Steps 2-3)

### "User profile not found"
➡️ Trigger not working. Re-run schema migration

### No time slots showing
➡️ Check date is not in the past

### Cannot cancel booking
➡️ Booking time already passed (can only cancel before start)

### Weekly limit not working
➡️ Database function not created. Re-run schema migration

## ✨ Success Indicators

You'll know everything is working when:

✅ Can create accounts for all 3 roles  
✅ Can login and see correct dashboard  
✅ Can create and cancel bookings  
✅ Staff can manage tasks  
✅ Admin can view analytics  
✅ Real-time updates work  
✅ Notifications appear  
✅ UI is light blue (not purple)  

## 📚 Additional Help

- **Detailed Setup:** [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)
- **Database Guide:** [DATABASE_SETUP.md](DATABASE_SETUP.md)
- **Full Documentation:** [README.md](README.md)

---

**Once all checkboxes are checked, you're ready to use FixMyRoom! 🎉**
