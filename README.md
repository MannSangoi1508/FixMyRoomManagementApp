# FixMyRoom - Hostel Maintenance & Housekeeping Management System

> **🎉 UPDATED: Fully integrated with Supabase PostgreSQL + Light Blue UI**

A comprehensive web application for managing hostel maintenance and housekeeping operations with role-based dashboards for Students, Staff, and Admins/Wardens.

## ⚡ Quick Start

**⚠️ FIRST TIME SETUP REQUIRED**

Before using the app, you must set up the database **once**:

👉 **[Follow SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** for the complete setup guide

**Quick version:**
1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/juhpvwhhxzibsaxwwgeu/sql)
2. Run SQL from `/supabase/migrations/20260528000001_initial_schema.sql`
3. Run SQL from `/supabase/migrations/20260528000002_seed_data.sql`
4. Done! Start using the app.

## ✨ What's New

- ✅ **UI Color Changed:** Purple → Light Blue (Sky)
- ✅ **Proper Supabase Database:** PostgreSQL with RLS instead of KV store
- ✅ **Fixed Authentication:** Signup and login now work perfectly
- ✅ **Real-time Updates:** Automatic dashboard synchronization
- ✅ **Database Triggers:** Auto-create profiles and notifications
- ✅ **Secure Access:** Row Level Security for all roles

## Features

### 🎓 Student Features
- **Dashboard Overview**
  - Room number and hostel details display
  - Weekly housekeeping booking counter (1 booking per week)
  - Completed and pending bookings count
  - Real-time notifications
  - Quick action buttons for new bookings
  - Upcoming bookings with cancellation option
  - Recent completed bookings history
  - Rules and regulations display

- **Booking Management**
  - Create Housekeeping bookings (1 PM - 9 PM)
    - 1 slot every 15 minutes (1-4 PM)
    - 3 slots every 15 minutes (4-9 PM)
    - Maximum 1 booking per week
  - Create Maintenance bookings (9 AM - 9 PM)
    - 1 slot every 15 minutes
    - Unlimited bookings
    - Photo upload for complaints
  - Emergency housekeeping option when slots are full
  - Cancel bookings before start time
  - Automatic credit restoration on cancellation

- **Schedule Overview**
  - View all bookings across hostels
  - Filter by hostel, floor, service type, and date
  - Color-coded service types
  - Detailed booking information on click

- **Notifications**
  - Booking confirmations
  - Cancellations
  - Status updates
  - Admin schedule edits

### 👨‍🔧 Staff Features
- **Task Dashboard**
  - Pending tasks count
  - In-progress tasks count
  - Completed tasks count
  - High priority tasks (maintenance & emergency)

- **Task Management**
  - View assigned and unassigned tasks
  - Filter by status, service type, hostel, and floor
  - Start task action (auto-assigns staff)
  - Mark complete action
  - View photos for maintenance requests
  - Real-time task updates

- **Schedule Access**
  - Full schedule overview
  - Same filtering capabilities as students

### 👔 Admin/Warden Features
- **Dashboard Analytics**
  - Total bookings overview
  - Completed, pending, in-progress counts
  - Active staff count
  - Flagged students (2+ cancelled bookings)
  - Completion rate percentage

- **Detailed Analytics**
  - Service distribution (Housekeeping, Maintenance, Emergency)
  - Status overview
  - Hostel-wise statistics
  - Floor-wise statistics
  - User statistics (students, staff, admins)

- **Management Tools**
  - View all bookings
  - View all users
  - Reset weekly booking counts (normally runs Sunday 11:59 PM)
  - Recent bookings table
  - Flagged students monitoring

- **Override Capabilities**
  - Manually edit schedules
  - Update bookings
  - Reassign staff
  - Manage emergency slots

## Technology Stack

### Frontend
- **React 18.3.1** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **Lucide React** - Icons
- **@supabase/supabase-js** - Authentication & real-time updates

### Backend
- **Supabase Edge Functions** - Serverless backend
- **Hono** - Web framework
- **Deno** - Runtime environment
- **KV Store** - Database (key-value storage)

## Project Structure

```
/workspaces/default/code/
├── src/
│   ├── app/
│   │   ├── App.tsx                    # Main application with routing
│   │   └── components/
│   │       ├── Login.tsx              # Authentication UI
│   │       ├── StudentDashboard.tsx   # Student portal
│   │       ├── StaffDashboard.tsx     # Staff portal
│   │       ├── AdminDashboard.tsx     # Admin portal
│   │       ├── BookingForm.tsx        # Booking creation form
│   │       └── ScheduleOverview.tsx   # Shared schedule view
│   └── styles/
│       ├── fonts.css
│       └── theme.css
├── supabase/
│   └── functions/
│       └── server/
│           ├── index.tsx              # API routes
│           └── kv_store.tsx           # Database utilities
└── utils/
    └── supabase/
        └── info.tsx                   # Supabase config
```

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user account
- `GET /auth/profile` - Get current user profile

### Bookings
- `POST /bookings` - Create new booking
- `GET /bookings` - Get user's bookings
- `POST /bookings/cancel/:bookingId` - Cancel a booking

### Staff
- `GET /staff/tasks` - Get staff tasks
- `POST /staff/tasks/:bookingId/status` - Update task status

### Admin
- `GET /admin/bookings` - Get all bookings
- `GET /admin/users` - Get all users
- `PUT /admin/bookings/:bookingId` - Update booking (override)
- `GET /admin/analytics` - Get analytics data
- `POST /admin/reset-weekly-counts` - Reset weekly booking counts

### Schedule
- `GET /schedule` - Get schedule overview (all users)

### Notifications
- `GET /notifications` - Get user notifications
- `POST /notifications/:notificationId/read` - Mark as read

## Setup Instructions

### 1. Supabase Connection
The application is already connected to Supabase. The connection details are in:
- `/utils/supabase/info.tsx` - Contains project ID and anon key
- `/supabase/functions/server/index.tsx` - Backend server

### 2. User Roles
Three user roles are supported:
- **student** - Access to Student Dashboard
- **staff** - Access to Staff Dashboard
- **admin** - Access to Admin Dashboard

### 3. Weekly Reset
Booking counters reset every Sunday at 11:59 PM. Admins can manually trigger reset using the "Reset Weekly Counts" button.

### 4. Time Slots

**Housekeeping (1 PM - 9 PM)**
- 1:00 PM - 4:00 PM: 1 slot per 15 minutes
- 4:00 PM - 9:00 PM: 3 slots per 15 minutes
- Maximum: 1 booking per student per week

**Maintenance (9 AM - 9 PM)**
- 9:00 AM - 9:00 PM: 1 slot per 15 minutes
- Unlimited bookings per student

**Emergency Housekeeping**
- Available when regular slots are exhausted
- 1-hour window (staff arrives anytime within hour)

### 5. Booking Cancellation Rules
- Students can cancel before booking start time
- Slot becomes available again after cancellation
- Housekeeping credit restored on cancellation
- Cannot cancel after booking starts
- Cannot cancel completed bookings

### 6. Real-time Updates
- All dashboards auto-refresh every 5 seconds
- Booking status updates sync across all users
- Notifications delivered in real-time
- Schedule changes reflect immediately

## Data Models

### User
```typescript
{
  id: string
  email: string
  name: string
  role: 'student' | 'staff' | 'admin'
  roomNumber?: string  // for students
  hostel?: string      // for students
  floor?: string       // for students
  weeklyBookingCount: number
  lastResetDate: string
  createdAt: string
}
```

### Booking
```typescript
{
  id: string
  userId: string
  userName: string
  roomNumber: string
  hostel: string
  floor: string
  serviceType: 'housekeeping' | 'maintenance'
  date: string
  timeSlot: string
  notes: string
  photos: string[]
  isEmergency: boolean
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  assignedStaff: string | null
  assignedStaffName: string | null
  createdAt: string
  updatedAt: string
}
```

### Notification
```typescript
{
  id: string
  userId: string
  type: string
  message: string
  read: boolean
  createdAt: string
  bookingId?: string
}
```

## Security Features

- **Role-based access control** - Users only see their permitted data
- **Authentication required** - All API routes require valid session token
- **Staff task isolation** - Staff only see assigned or available tasks
- **Admin-only routes** - Analytics and management endpoints restricted
- **Input validation** - Server-side validation for all inputs
- **Auto-confirm email** - Development mode (no email server needed)

## Scalability

The system is designed to support:
- Multiple hostels/buildings
- Multiple floors per hostel
- Unlimited students per hostel
- Unlimited staff members
- Concurrent bookings across different rooms
- Real-time synchronization across all users

## Future Enhancements

Potential features for production deployment:
- Email notifications via SMTP
- SMS alerts for emergencies
- Staff performance ratings
- Student feedback system
- Maintenance issue categorization
- Recurring maintenance schedules
- File upload to Supabase Storage
- Advanced analytics dashboards
- Export reports (PDF/Excel)
- Mobile app version

## Development

The application is built for the Figma Make environment and uses:
- Vite as the build tool
- React for the UI
- Supabase Edge Functions for the backend
- KV Store for data persistence

Auto-reload is enabled for development changes.

## Important Notes

⚠️ **This is a prototype for demonstration purposes.**
- Not intended for collecting personally identifiable information (PII)
- Not designed for securing sensitive production data
- Use for prototyping and internal testing only

## Support

For issues or questions:
- Check the browser console for error messages
- Verify Supabase connection is active
- Ensure user has correct role assigned
- Check that weekly booking limits haven't been exceeded

---

Built with ❤️ using React, Tailwind CSS, and Supabase
