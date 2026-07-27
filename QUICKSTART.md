# Quick Start Guide - FixMyRoom

## Testing the Application

### Step 1: Create Test Accounts

Use the **Sign Up** tab in the login screen to create test accounts for each role:

#### Student Account
```
Name: John Doe
Login As: Student
Hostel: A
Floor: 3
Room Number: 301
Email: student@university.edu
Password: password123
```

#### Staff Account
```
Name: Jane Smith
Login As: Maintenance/Housekeeping Staff
Email: staff@university.edu
Password: password123
```

#### Admin Account
```
Name: Admin User
Login As: Admin/Warden
Email: admin@university.edu
Password: password123
```

### Step 2: Test Student Features

1. **Sign in as student** (student@university.edu)
2. Click **"New Booking"** quick action
3. Select **Housekeeping** service
4. Choose today's date
5. Pick an available time slot
6. Add optional notes
7. Click **"Create Booking"**
8. View the booking in "Upcoming Bookings"
9. Try cancelling before the booking time starts
10. Check the **Schedule** tab to see all bookings
11. View **Notifications** for booking confirmations

### Step 3: Test Staff Features

1. **Sign out** and **sign in as staff** (staff@university.edu)
2. View **Pending** tasks (the booking you just created)
3. Click **"Start Task"** to assign yourself
4. Task moves to **In Progress**
5. Click **"Mark Complete"** when done
6. View the **Schedule Overview** tab
7. Filter by hostel, floor, or service type

### Step 4: Test Admin Features

1. **Sign out** and **sign in as admin** (admin@university.edu)
2. View **Dashboard** with all analytics:
   - Total bookings
   - Completed count
   - Pending count
   - In Progress count
   - Active staff count
3. Check **Analytics** tab:
   - Hostel-wise statistics
   - Floor-wise statistics
   - Service distribution
   - User statistics
4. View **Schedule Overview**
5. Click **"Reset Weekly Counts"** to manually reset student booking limits

### Step 5: Test Real-time Updates

1. Open the app in **two browser windows**
2. Sign in as **Student** in window 1
3. Sign in as **Staff** in window 2
4. Create a booking in student window
5. Watch it appear in staff window within 5 seconds
6. Start the task in staff window
7. See status update in student window

### Step 6: Test Booking Limits

1. Sign in as a student
2. Create 1 housekeeping booking
3. Try creating another housekeeping booking
4. You should see: "Weekly housekeeping limit reached"
5. Maintenance bookings have no limit - create multiple

### Step 7: Test Cancellation

1. Create a booking for tomorrow
2. Click **"Cancel Booking"** button
3. Confirm cancellation
4. Booking status changes to "Cancelled"
5. Weekly credit is restored
6. Slot becomes available again

### Step 8: Test Emergency Booking

1. Book multiple housekeeping slots for the same time
2. When all slots are full, emergency option appears
3. Check "Request Emergency Housekeeping"
4. Create emergency booking
5. Marked as "🚨 EMERGENCY" in all dashboards

### Step 9: Test Photo Upload (Maintenance)

1. Create a **Maintenance** booking
2. Click photo upload area
3. Select one or more images
4. Photos appear as thumbnails
5. Staff can view photos when task is assigned

### Step 10: Test Filters & Search

**In Schedule Overview:**
1. Filter by **Hostel**
2. Filter by **Floor**
3. Filter by **Service Type**
4. Filter by **Date**
5. Click on any booking to see full details

**In Staff Dashboard:**
1. Filter by **Status** (Pending/In Progress/Completed)
2. Filter by **Service Type**
3. Filter by **Hostel**
4. Filter by **Floor**

## Testing Checklist

- [ ] Student can sign up and sign in
- [ ] Student can create housekeeping booking
- [ ] Student can create maintenance booking
- [ ] Student can cancel booking before start time
- [ ] Student cannot cancel after start time
- [ ] Weekly booking limit works (1 housekeeping per week)
- [ ] Emergency booking appears when slots full
- [ ] Staff can view pending tasks
- [ ] Staff can start task (auto-assigns)
- [ ] Staff can mark task complete
- [ ] Admin can view analytics
- [ ] Admin can view all bookings
- [ ] Admin can view all users
- [ ] Admin can reset weekly counts
- [ ] Real-time updates work across dashboards
- [ ] Notifications appear for all events
- [ ] Schedule overview shows all bookings
- [ ] Filters work correctly
- [ ] Photos upload for maintenance requests
- [ ] Booking details modal shows all info
- [ ] Status colors are correct
- [ ] Past time slots are disabled/greyed out

## Common Test Scenarios

### Scenario 1: Complete Booking Flow
Student creates booking → Staff sees it → Staff starts task → Staff completes task → Student sees completion notification

### Scenario 2: Cancellation Flow
Student creates booking → Student cancels before start time → Slot becomes available → Credit restored

### Scenario 3: Multiple Hostels
Create students in different hostels (A, B, C) → Create bookings → Filter by hostel in schedule

### Scenario 4: Flagged Students
Student creates booking → Student cancels → Repeat 2 times → Admin sees student in "Flagged Students"

### Scenario 5: High Priority Tasks
Create emergency booking → Staff sees it marked as "🚨 EMERGENCY" in high priority section

## Tips

- **Refresh**: Real-time updates happen every 5 seconds automatically
- **Time Slots**: Only future time slots are available
- **Booking Limit**: Resets every Sunday 11:59 PM (or manually via admin)
- **Staff Assignment**: First staff to click "Start Task" gets assigned
- **Admin Override**: Admins can manually edit any booking

## Troubleshooting

### "Unauthorized" Error
- Sign out and sign in again
- Check that you're using the correct role account

### Booking Not Appearing
- Wait 5 seconds for auto-refresh
- Check filters aren't hiding the booking
- Verify booking was created successfully

### Cannot Cancel Booking
- Check if booking time has already passed
- Verify booking isn't already completed
- Confirm booking isn't already cancelled

### No Time Slots Available
- Check if you selected a past date
- Check if all slots for that time are booked
- For housekeeping, check emergency booking option

## Next Steps

After testing:
1. Create more students in different rooms
2. Create more staff members
3. Test concurrent bookings
4. Monitor analytics dashboard
5. Test weekly reset functionality
6. Explore all filtering options
7. Test notification system thoroughly

---

Enjoy testing FixMyRoom! 🎉
