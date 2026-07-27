# 🚀 START HERE - FixMyRoom Quick Setup

## ⚡ What Changed

### 1. UI Color: Purple → Light Blue ✅
The entire application now uses a modern **light blue (sky)** color scheme instead of purple.

### 2. Backend: KV Store → PostgreSQL Database ✅
Migrated to proper Supabase PostgreSQL with:
- Real database tables with relationships
- Row Level Security (RLS) for secure access
- Automatic triggers for profiles and notifications
- Database-level validation
- Real-time synchronization

### 3. Authentication: Fixed ✅
- Proper Supabase Auth integration
- Automatic user profile creation
- Fixed "Failed to fetch" errors
- Fixed "User profile not found" errors

## 🎯 What You Need To Do (5 Minutes)

### One-Time Database Setup

**You must run SQL migrations once before using the app.**

#### Quick Setup (3 steps):

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/juhpvwhhxzibsaxwwgeu/sql
   - Click **New Query**

2. **Run Schema Migration**
   - Open file: `/supabase/migrations/20260528000001_initial_schema.sql`
   - Copy ALL the SQL
   - Paste into Supabase SQL Editor
   - Click **RUN** (top right)
   - Wait for "Success" message

3. **Run Seed Data**
   - Click **New Query** again
   - Open file: `/supabase/migrations/20260528000002_seed_data.sql`
   - Copy ALL the SQL
   - Paste into Supabase SQL Editor
   - Click **RUN**
   - Wait for "Success" message

**That's it! Database is ready.** ✅

## 🧪 Test It Works

### Create Your First Account

1. Open FixMyRoom app
2. Click **Sign Up** tab
3. Fill in:
   ```
   Name: Test Student
   Email: student@test.edu
   Password: password123
   Role: Student
   Hostel: A
   Floor: 3
   Room: 301
   ```
4. Click **Create Account**

**✅ If you're logged in to the Student Dashboard, it works!**

### Create a Booking

1. Click **New Booking** button
2. Select **Housekeeping**
3. Choose today's date
4. Pick any available time slot
5. Click **Create Booking**

**✅ If the booking appears in "Upcoming Bookings", it works!**

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** | Step-by-step checklist ✅ |
| **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** | Complete setup guide 📖 |
| **[DATABASE_SETUP.md](DATABASE_SETUP.md)** | Database details and troubleshooting 🔧 |
| **[README.md](README.md)** | Full feature documentation 📚 |
| **[QUICKSTART.md](QUICKSTART.md)** | Testing scenarios 🧪 |

## 🎯 Quick Reference

### Test Accounts to Create

| Role | Email | Password | Details |
|------|-------|----------|---------|
| Student | student@test.edu | password123 | Hostel A, Floor 3, Room 301 |
| Staff | staff@test.edu | password123 | - |
| Admin | admin@test.edu | password123 | - |

### Key Features

| Feature | Available To |
|---------|--------------|
| Create bookings | Students |
| Cancel bookings (before start time) | Students |
| View schedule | Everyone |
| Manage tasks | Staff |
| View analytics | Admins |
| Reset weekly counters | Admins |

### Booking Rules

| Service | Hours | Slots | Limit |
|---------|-------|-------|-------|
| Housekeeping | 1 PM - 9 PM | Variable (1-3 per 15min) | 1 per week |
| Maintenance | 9 AM - 9 PM | 1 per 15min | Unlimited |
| Emergency | 1 PM - 9 PM | 1-hour windows | When slots full |

## 🐛 Troubleshooting

### Problem: "Failed to fetch" during signup
**Solution:** Run the database migrations (see steps above)

### Problem: "User profile not found"
**Solution:** Database trigger not working. Re-run schema migration.

### Problem: No time slots available
**Solution:** 
1. Check you selected a future date
2. Try emergency booking for housekeeping

### Problem: Cannot cancel booking
**Solution:** Can only cancel before booking start time

## ✨ What You Get

After setup, you have a fully functional system with:

✅ **Secure Authentication** - Email/password with auto-profile creation  
✅ **Student Dashboard** - Create bookings, upload photos, cancel bookings  
✅ **Staff Dashboard** - Manage tasks, update status, view assignments  
✅ **Admin Dashboard** - Analytics, user management, override controls  
✅ **Real-time Updates** - All dashboards sync automatically  
✅ **Smart Validation** - Prevent double booking, enforce limits  
✅ **Automatic Notifications** - Instant alerts for all events  
✅ **Weekly Reset** - Booking counters reset every Sunday  
✅ **Light Blue UI** - Modern, professional color scheme  

## 🎉 That's It!

**Total setup time: ~5 minutes**

1. ✅ Run 2 SQL migrations (2 minutes)
2. ✅ Create test account (1 minute)
3. ✅ Test booking (1 minute)
4. ✅ Done!

---

**Need more help?** Check [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for detailed guidance.

**Ready to go?** Start with the database setup steps above! 👆
