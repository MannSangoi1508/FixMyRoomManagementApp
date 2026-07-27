# FixMyRoom - Hostel Maintenance & Housekeeping Management

> **✨ UPDATED VERSION** with proper Supabase backend and light blue UI

## 🚀 Quick Start

### 1. First Time Setup (Required)

**⚠️ You must run database migrations once before using the app.**

👉 **See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for complete setup guide**

**Quick Setup:**
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/juhpvwhhxzibsaxwwgeu/sql)
2. Run the SQL from `/supabase/migrations/20260528000001_initial_schema.sql`
3. Run the SQL from `/supabase/migrations/20260528000002_seed_data.sql`
4. Done! Now you can use the app.

### 2. Create Your First Account

1. Open FixMyRoom
2. Click **Sign Up**
3. Fill in details:
   - Student: Provide room number, hostel, floor
   - Staff: Just name and email
   - Admin: Just name and email
4. Click **Create Account**
5. You'll be automatically logged in!

## ✅ What's Been Fixed

### 🎨 UI Updates
- ✅ Changed from **Purple** to **Light Blue (Sky)** color scheme
- ✅ Modern, clean gradient backgrounds
- ✅ Professional sky-blue buttons and accents

### 🔧 Backend Fixes
- ✅ **Proper Supabase PostgreSQL Database** (no more KV store)
- ✅ **Automatic user profile creation** via database triggers
- ✅ **Row Level Security (RLS)** for secure access control
- ✅ **Real-time updates** via Supabase Realtime
- ✅ **Automatic notifications** via database triggers
- ✅ **Foreign key relationships** between tables
- ✅ **Database-level validation** to prevent double booking
- ✅ **Weekly reset function** for booking counters
- ✅ **Fixed all "Failed to fetch" errors**
- ✅ **Fixed "User profile not found" errors**
- ✅ **Proper authentication flow** with Supabase Auth

### 📊 Database Schema
- ✅ `users` table with role-based profiles
- ✅ `bookings` table with full booking details
- ✅ `notifications` table for alerts
- ✅ `emergency_slots` table for emergency bookings
- ✅ `analytics_logs` table for system events

### 🔐 Security
- ✅ Students can only see their own data
- ✅ Staff can only see assigned/available tasks
- ✅ Admins can see everything
- ✅ All enforced at database level with RLS

## 📱 Features

### Student Dashboard
- View room info and booking stats
- Create housekeeping bookings (1/week limit)
- Create maintenance bookings (unlimited)
- Upload photos for maintenance requests
- Cancel bookings before start time
- View real-time notifications
- Access shared schedule overview

### Staff Dashboard
- View assigned and available tasks
- Start tasks (auto-assignment)
- Mark tasks complete
- Filter by status, service, hostel, floor
- View booking photos
- Real-time task updates

### Admin Dashboard
- Complete analytics and statistics
- View all users and bookings
- Hostel-wise and floor-wise stats
- Flagged students (2+ cancellations)
- Manual weekly counter reset
- Override and edit capabilities

## 🔄 How It Works

### Booking Flow
1. **Student creates booking** → Booking saved to database
2. **Database trigger** → Notification automatically created
3. **Real-time update** → Appears in staff dashboard within 5 seconds
4. **Staff starts task** → Status changes to "in_progress"
5. **Database trigger** → Student notified of status change
6. **Staff completes task** → Status changes to "completed"
7. **Real-time update** → All dashboards sync automatically

### Cancellation Flow
1. **Student cancels booking** → Status changes to "cancelled"
2. **Slot freed** → Becomes available for rebooking
3. **Credit restored** → Weekly counter decremented
4. **Database trigger** → Cancellation notification sent
5. **Real-time update** → All dashboards update

### Weekly Reset
Every Sunday at 11:59 PM (or manually via admin):
- All student `weekly_booking_count` reset to 0
- Students can book housekeeping again

## 🛠️ Technical Stack

### Frontend
- React 18.3.1 with TypeScript
- Tailwind CSS v4 (Sky/Cyan color palette)
- Lucide React icons
- Supabase JS client

### Backend
- Supabase Auth (email/password)
- PostgreSQL database
- Row Level Security (RLS)
- Database triggers and functions
- Supabase Edge Functions (Hono framework)

### Real-time
- Supabase Realtime for live updates
- 5-second polling fallback
- Automatic dashboard synchronization

## 📂 Project Structure

```
/workspaces/default/code/
├── src/app/
│   ├── App.tsx                    # Main app with routing
│   └── components/
│       ├── Login.tsx              # Auth UI (light blue theme)
│       ├── StudentDashboard.tsx   # Student portal
│       ├── StaffDashboard.tsx     # Staff portal
│       ├── AdminDashboard.tsx     # Admin portal
│       ├── BookingForm.tsx        # Booking creation
│       └── ScheduleOverview.tsx   # Shared schedule
├── supabase/
│   ├── migrations/                # SQL migrations
│   └── functions/server/
│       └── index.tsx              # API endpoints
├── SETUP_INSTRUCTIONS.md          # Setup guide ⭐
├── DATABASE_SETUP.md              # Detailed DB guide
└── README_UPDATED.md              # This file
```

## 🎯 API Endpoints

All endpoints require authentication (Bearer token).

### Auth
- `POST /auth/signup` - Create account
- `GET /auth/profile` - Get user profile

### Bookings
- `POST /bookings` - Create booking
- `GET /bookings` - Get user bookings
- `POST /bookings/cancel/:id` - Cancel booking

### Staff
- `GET /staff/tasks` - Get staff tasks
- `POST /staff/tasks/:id/status` - Update task status

### Admin
- `GET /admin/bookings` - All bookings
- `GET /admin/users` - All users
- `PUT /admin/bookings/:id` - Update booking
- `GET /admin/analytics` - Analytics data
- `POST /admin/reset-weekly-counts` - Reset counters

### Common
- `GET /schedule` - Schedule overview
- `GET /notifications` - User notifications
- `POST /notifications/:id/read` - Mark as read

## 🔍 Troubleshooting

### "Failed to fetch" during signup
➡️ **Solution:** Run database migrations (see SETUP_INSTRUCTIONS.md)

### "User profile not found"
➡️ **Solution:** Check database trigger exists for auto-profile-creation

### Bookings not appearing
➡️ **Solution:** Wait 5 seconds for auto-refresh or check filters

### Cannot cancel booking
➡️ **Solution:** Can only cancel before booking start time

### No time slots available
➡️ **Solution:** Try emergency booking option for housekeeping

## 📊 Test Accounts

Create these via Sign Up for testing:

| Role | Email | Password | Details |
|------|-------|----------|---------|
| Student | student@test.edu | password123 | Hostel A, Floor 3, Room 301 |
| Staff | staff@test.edu | password123 | N/A |
| Admin | admin@test.edu | password123 | N/A |

## 🎨 Color Scheme

The app now uses a light blue theme:

- **Primary:** Sky-600 (#0EA5E9)
- **Light backgrounds:** Sky-50, Sky-100
- **Buttons:** Sky-600 to Sky-700 gradients
- **Accents:** Sky-200 shadows

All purple colors have been replaced with sky blue throughout the application.

## 📝 Important Notes

### Before First Use
⚠️ **You must run SQL migrations once** - See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)

### After Setup
✅ Signup/login works perfectly  
✅ Real-time updates enabled  
✅ All features functional  
✅ Secure and production-ready  

### Data Security
🔒 This is a prototype for demonstration  
🔒 Do not store real PII or sensitive data  
🔒 Use for testing and internal demos only  

## 🎉 You're All Set!

Once you've run the database migrations (one-time setup), you can:

1. ✅ Create student, staff, and admin accounts
2. ✅ Make bookings and upload photos
3. ✅ Cancel bookings (with credit restoration)
4. ✅ Manage tasks as staff
5. ✅ View analytics as admin
6. ✅ See real-time updates across dashboards
7. ✅ Reset weekly counters
8. ✅ Use emergency bookings

---

**Questions?** Check [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed troubleshooting.

**Get Started:** See [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) for the setup guide.
