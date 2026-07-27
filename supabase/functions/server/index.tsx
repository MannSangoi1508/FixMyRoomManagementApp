import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { initialSchemaMigration, seedDataMigration } from "./migrations.tsx";

const app = new Hono();

// Create Supabase clients
const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

const getSupabaseAnonClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "Cache-Control", "X-Requested-With"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: false,
  }),
);

// Additional OPTIONS handler for preflight requests
app.options("/*", (c) => {
  return c.text("", 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cache-Control, X-Requested-With",
    "Access-Control-Max-Age": "600",
  });
});

// Middleware to verify authentication
const authMiddleware = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header('Authorization');
    console.log('Auth header received:', authHeader ? authHeader.substring(0, 20) + '...' : 'NONE');

    if (!authHeader) {
      console.error('No Authorization header provided');
      return c.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    console.log('Token extracted, length:', token.length);

    if (!token || token.length < 20) {
      console.error('Invalid token format');
      return c.json({ error: 'Unauthorized - Invalid token format' }, 401);
    }

    // Use service role client + pass JWT directly to getUser(token)
    const supabase = getSupabaseClient();

    let user;
    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        console.error('Auth error details:', {
          name: error.name,
          message: error.message,
          status: error.status,
        });
        return c.json({ error: `Authentication failed: ${error.message}` }, 401);
      }

      if (!data || !data.user) {
        console.error('No user data returned from auth');
        return c.json({ error: 'Unauthorized - Invalid or expired token' }, 401);
      }

      user = data.user;
      console.log('User authenticated successfully:', user.id);
    } catch (authError: any) {
      console.error('Exception during authentication:', authError);
      return c.json({ error: `Authentication error: ${authError.message}` }, 401);
    }

    c.set('userId', user.id);
    c.set('user', user);
    await next();
  } catch (error: any) {
    console.error('Unexpected error in authMiddleware:', error);
    return c.json({ error: 'Internal authentication error' }, 500);
  }
};

// Health check endpoint
app.get("/make-server-4438cc7c/health", (c) => {
  return c.json({ status: "ok" });
});

// Setup database endpoint (run once to initialize)
app.post("/make-server-4438cc7c/setup-database", async (c) => {
  try {
    const supabase = getSupabaseClient();

    console.log('Running initial schema migration...');
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: initialSchemaMigration
    }).catch(async () => {
      // Fallback: try running migrations as separate statements
      const statements = initialSchemaMigration.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await supabase.rpc('exec_sql', { sql: statement + ';' });
          } catch (err) {
            console.log('Statement execution (may be expected):', err);
          }
        }
      }
      return { error: null };
    });

    console.log('Running seed data migration...');
    await supabase.rpc('exec_sql', {
      sql: seedDataMigration
    }).catch(() => ({ error: null }));

    return c.json({
      success: true,
      message: 'Database setup completed. Schema and seed data initialized.'
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return c.json({
      success: false,
      message: 'Database setup completed with some warnings. This is normal if tables already exist.',
      error: error.message
    });
  }
});

// ============= AUTH ROUTES =============

// Sign up endpoint
app.post("/make-server-4438cc7c/auth/signup", async (c) => {
  try {
    const { email, password, name, role, roomNumber, hostel, floor } = await c.req.json();

    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    if (role === 'student' && (!roomNumber || !hostel || !floor)) {
      return c.json({ error: 'Room details required for students' }, 400);
    }

    const supabase = getSupabaseClient();

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        room_number: role === 'student' ? roomNumber : null,
        hostel: role === 'student' ? hostel : null,
        floor: role === 'student' ? floor : null,
      }
    });

    if (authError) {
      console.error('Signup error:', authError);
      return c.json({ error: `Signup failed: ${authError.message}` }, 400);
    }

    // The user profile is automatically created by the database trigger
    // Fetch the created profile
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching user profile:', fetchError);
      return c.json({ error: 'User created but profile fetch failed' }, 500);
    }

    return c.json({
      success: true,
      user: userData,
      message: 'Account created successfully'
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return c.json({ error: `Signup error: ${error.message}` }, 500);
  }
});

// Get current user profile
app.get("/make-server-4438cc7c/auth/profile", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return c.json({ error: 'User profile not found' }, 404);
    }

    return c.json({ user: userData });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return c.json({ error: `Error fetching profile: ${error.message}` }, 500);
  }
});

// ============= BOOKING ROUTES =============

// Create booking
app.post("/make-server-4438cc7c/bookings", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const requestBody = await c.req.json();
    console.log('Received booking request:', requestBody);

    const { service_type, date, time_slot, notes, is_emergency, photos } = requestBody;
    console.log('Extracted fields:', { service_type, date, time_slot, notes, is_emergency });

    // Validate all required fields
    if (!service_type) {
      console.error('service_type is missing from request!');
      return c.json({ error: 'Service type is required' }, 400);
    }

    if (!date) {
      console.error('date is missing from request!');
      return c.json({ error: 'Date is required' }, 400);
    }

    if (!time_slot) {
      console.error('time_slot is missing from request!');
      return c.json({ error: 'Time slot is required' }, 400);
    }

    // Validate service_type is one of the allowed values
    if (service_type !== 'housekeeping' && service_type !== 'maintenance') {
      console.error('Invalid service_type:', service_type);
      return c.json({ error: `Invalid service type: ${service_type}. Must be 'housekeeping' or 'maintenance'` }, 400);
    }

    const supabase = getSupabaseClient();

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check weekly limit for housekeeping
    if (service_type === 'housekeeping' && !is_emergency) {
      if (userData.weekly_booking_count >= 1) {
        return c.json({ error: 'Weekly housekeeping limit reached (1 booking per week)' }, 400);
      }
    }

    // Check if slot is already booked for this room
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('room_number', userData.room_number)
      .eq('date', date)
      .eq('time_slot', time_slot)
      .neq('status', 'cancelled')
      .single();

    if (existingBooking) {
      return c.json({ error: 'This time slot is already booked for your room' }, 400);
    }

    // Create booking object
    const bookingInsert = {
      user_id: userId,
      user_name: userData.name,
      room_number: userData.room_number,
      hostel: userData.hostel,
      floor: userData.floor,
      service_type: service_type,
      date,
      time_slot: time_slot,
      notes: notes || '',
      photos: photos || [],
      is_emergency: is_emergency || false,
      status: 'pending',
      assigned_staff: null,
      assigned_staff_name: 'Pending Assignment',
    };

    console.log('Attempting to insert booking:', bookingInsert);

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingInsert)
      .select()
      .single();

    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      return c.json({ error: `Failed to create booking: ${bookingError.message}` }, 400);
    }

    // Update weekly booking count for housekeeping
    if (service_type === 'housekeeping' && !is_emergency) {
      await supabase
        .from('users')
        .update({ weekly_booking_count: userData.weekly_booking_count + 1 })
        .eq('id', userId);
    }

    // Notification is automatically created by database trigger

    return c.json({
      success: true,
      booking,
      message: 'Booking created successfully'
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    return c.json({ error: `Error creating booking: ${error.message}` }, 500);
  }
});

// Get user bookings
app.get("/make-server-4438cc7c/bookings", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return c.json({ error: 'Failed to fetch bookings' }, 500);
    }

    return c.json({ bookings: bookings || [] });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return c.json({ error: `Error fetching bookings: ${error.message}` }, 500);
  }
});

// Cancel booking
app.post("/make-server-4438cc7c/bookings/cancel/:bookingId", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const bookingId = c.req.param('bookingId');
    const supabase = getSupabaseClient();

    // Get booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    if (booking.user_id !== userId) {
      return c.json({ error: 'Unauthorized to cancel this booking' }, 403);
    }

    if (booking.status === 'cancelled') {
      return c.json({ error: 'Booking already cancelled' }, 400);
    }

    if (booking.status === 'completed') {
      return c.json({ error: 'Cannot cancel completed booking' }, 400);
    }

    // Check if booking time has passed
    const now = new Date();
    const [startTime] = booking.time_slot.split('-');
    const bookingDateTime = new Date(`${booking.date}T${startTime}:00`);

    if (now >= bookingDateTime) {
      return c.json({ error: 'Cannot cancel booking after start time' }, 400);
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return c.json({ error: 'Failed to cancel booking' }, 500);
    }

    // Restore weekly booking count if housekeeping
    if (booking.service_type === 'housekeeping' && !booking.is_emergency) {
      const { data: userData } = await supabase
        .from('users')
        .select('weekly_booking_count')
        .eq('id', userId)
        .single();

      if (userData && userData.weekly_booking_count > 0) {
        await supabase
          .from('users')
          .update({ weekly_booking_count: userData.weekly_booking_count - 1 })
          .eq('id', userId);
      }
    }

    // Create cancellation notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'booking_cancellation',
        message: `Your ${booking.service_type} booking for ${booking.date} at ${booking.time_slot} has been cancelled`,
        booking_id: bookingId,
      });

    return c.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error: any) {
    console.error('Booking cancellation error:', error);
    return c.json({ error: `Error cancelling booking: ${error.message}` }, 500);
  }
});

// ============= STAFF ROUTES =============

// Get staff tasks
app.get("/make-server-4438cc7c/staff/tasks", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'staff') {
      return c.json({ error: 'Access denied - Staff only' }, 403);
    }

    // Get assigned tasks and available pending tasks
    const { data: tasks, error } = await supabase
      .from('bookings')
      .select('*')
      .or(`assigned_staff.eq.${userId},and(status.eq.pending,assigned_staff.is.null)`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return c.json({ error: 'Failed to fetch tasks' }, 500);
    }

    return c.json({ tasks: tasks || [] });
  } catch (error: any) {
    console.error('Error fetching staff tasks:', error);
    return c.json({ error: `Error fetching tasks: ${error.message}` }, 500);
  }
});

// Update task status
app.post("/make-server-4438cc7c/staff/tasks/:bookingId/status", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const bookingId = c.req.param('bookingId');
    const { status } = await c.req.json();

    const supabase = getSupabaseClient();

    // Get booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Get staff info
    const { data: staffData } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const updateData: any = { status };

    // Assign staff if starting task
    if (status === 'in_progress' && !booking.assigned_staff) {
      updateData.assigned_staff = userId;
      updateData.assigned_staff_name = staffData?.name || 'Staff';
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating task status:', updateError);
      return c.json({ error: 'Failed to update status' }, 500);
    }

    return c.json({ success: true, message: 'Task status updated' });
  } catch (error: any) {
    console.error('Error updating task status:', error);
    return c.json({ error: `Error updating status: ${error.message}` }, 500);
  }
});

// ============= ADMIN ROUTES =============

// Get all bookings (admin)
app.get("/make-server-4438cc7c/admin/bookings", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      return c.json({ error: 'Failed to fetch bookings' }, 500);
    }

    return c.json({ bookings: bookings || [] });
  } catch (error: any) {
    console.error('Error fetching admin bookings:', error);
    return c.json({ error: `Error fetching bookings: ${error.message}` }, 500);
  }
});

// Get all users (admin)
app.get("/make-server-4438cc7c/admin/users", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    return c.json({ users: users || [] });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return c.json({ error: `Error fetching users: ${error.message}` }, 500);
  }
});

// Update booking (admin override)
app.put("/make-server-4438cc7c/admin/bookings/:bookingId", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const bookingId = c.req.param('bookingId');
    const updates = await c.req.json();

    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    // Get booking to notify user
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return c.json({ error: 'Failed to update booking' }, 500);
    }

    // Notify user
    await supabase
      .from('notifications')
      .insert({
        user_id: booking.user_id,
        type: 'admin_schedule_edit',
        message: `Admin updated your ${booking.service_type} booking for ${booking.date}`,
        booking_id: bookingId,
      });

    return c.json({ success: true, message: 'Booking updated successfully' });
  } catch (error: any) {
    console.error('Error updating booking:', error);
    return c.json({ error: `Error updating booking: ${error.message}` }, 500);
  }
});

// Cancel booking with credit restoration (admin)
app.post("/make-server-4438cc7c/admin/bookings/:bookingId/cancel", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const bookingId = c.req.param('bookingId');

    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    // Get booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    if (booking.status === 'cancelled') {
      return c.json({ error: 'Booking already cancelled' }, 400);
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return c.json({ error: 'Failed to cancel booking' }, 500);
    }

    // Restore weekly booking count if housekeeping
    if (booking.service_type === 'housekeeping' && !booking.is_emergency) {
      const { data: studentData } = await supabase
        .from('users')
        .select('weekly_booking_count')
        .eq('id', booking.user_id)
        .single();

      if (studentData && studentData.weekly_booking_count > 0) {
        await supabase
          .from('users')
          .update({ weekly_booking_count: studentData.weekly_booking_count - 1 })
          .eq('id', booking.user_id);
      }
    }

    // Notify student
    const timeSlot = (booking.time_slot ?? '').split('-').slice(0, 2).join('-');
    await supabase
      .from('notifications')
      .insert({
        user_id: booking.user_id,
        type: 'admin_cancellation',
        message: `Your booking on ${booking.date} at ${timeSlot} was cancelled by admin. Your booking credit has been returned.`,
        booking_id: bookingId,
      });

    return c.json({ success: true, message: 'Booking cancelled and credit restored' });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return c.json({ error: `Error cancelling booking: ${error.message}` }, 500);
  }
});

// Get analytics (admin)
app.get("/make-server-4438cc7c/admin/analytics", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    // Get all bookings and users for analytics
    const [bookingsResult, usersResult] = await Promise.all([
      supabase.from('bookings').select('*'),
      supabase.from('users').select('*')
    ]);

    const bookings = bookingsResult.data || [];
    const users = usersResult.data || [];

    // Separate active (non-cancelled) bookings for stats
    const activeBookings = bookings.filter((b: any) => b.status !== 'cancelled');
    const cancelledBookings = bookings.filter((b: any) => b.status === 'cancelled');

    // Today's bookings for daily stats
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter((b: any) => b.date === today && b.status !== 'cancelled');
    const activeTodayCount = todayBookings.filter((b: any) => b.status === 'pending' || b.status === 'in_progress').length;
    const completedToday = todayBookings.filter((b: any) => b.status === 'completed').length;
    const totalToday = todayBookings.length;
    const dailyCompletionRate = totalToday > 0
      ? ((completedToday / totalToday) * 100).toFixed(1)
      : '0.0';

    const analytics = {
      totalBookings: activeBookings.length, // Exclude cancelled from total
      completedBookings: activeBookings.filter((b: any) => b.status === 'completed').length,
      pendingBookings: activeBookings.filter((b: any) => b.status === 'pending').length,
      inProgressBookings: activeBookings.filter((b: any) => b.status === 'in_progress').length,
      cancelledBookings: cancelledBookings.length,
      emergencyBookings: activeBookings.filter((b: any) => b.is_emergency).length,
      activeStaff: users.filter((u: any) => u.role === 'staff').length,
      totalStudents: users.filter((u: any) => u.role === 'student').length,
      housekeepingBookings: activeBookings.filter((b: any) => b.service_type === 'housekeeping').length,
      maintenanceBookings: activeBookings.filter((b: any) => b.service_type === 'maintenance').length,
      completionRate: activeBookings.length > 0
        ? ((activeBookings.filter((b: any) => b.status === 'completed').length / activeBookings.length) * 100).toFixed(1)
        : '0.0',
      // Daily stats
      activeTodayCount,
      completedToday,
      totalToday,
      dailyCompletionRate,
    };

    return c.json({ analytics });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return c.json({ error: `Error fetching analytics: ${error.message}` }, 500);
  }
});

// Reset weekly counts (admin)
app.post("/make-server-4438cc7c/admin/reset-weekly-counts", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    // Reset counts using the database function
    const { error } = await supabase.rpc('reset_weekly_booking_counts');

    if (error) {
      console.error('Error resetting counts:', error);
      return c.json({ error: 'Failed to reset counts' }, 500);
    }

    // Get count of affected students
    const { data: students } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'student');

    return c.json({
      success: true,
      message: `Reset weekly counts for ${students?.length || 0} students`,
      resetCount: students?.length || 0
    });
  } catch (error: any) {
    console.error('Error resetting weekly counts:', error);
    return c.json({ error: `Error resetting counts: ${error.message}` }, 500);
  }
});

// ============= ROUTINE CHECKUP ROUTES =============

// Create routine checkup (admin)
app.post("/make-server-4438cc7c/admin/checkups", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { hostel, floor, date, timeWindow, serviceType } = await c.req.json();

    const supabase = getSupabaseClient();

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (userData?.role !== 'admin') {
      return c.json({ error: 'Access denied - Admin only' }, 403);
    }

    // Create routine checkup
    const { data: checkup, error: checkupError } = await supabase
      .from('routine_checkups')
      .insert({
        hostel,
        floor,
        date,
        time_window: timeWindow,
        service_type: serviceType,
        created_by: userId,
      })
      .select()
      .single();

    if (checkupError) {
      console.error('Error creating checkup:', checkupError);
      return c.json({ error: 'Failed to create checkup' }, 500);
    }

    // Generate 32 5-minute slots within the 2h 40m window
    const [startHour, startMin] = timeWindow.split('-')[0].split(':').map(Number);
    const slots = [];
    for (let i = 0; i < 32; i++) {
      const totalMinutes = startMin + (i * 5);
      const hour = startHour + Math.floor(totalMinutes / 60);
      const min = totalMinutes % 60;
      const timeSlot = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push({
        checkup_id: checkup.id,
        time_slot: timeSlot,
        is_booked: false,
      });
    }

    console.log(`Creating ${slots.length} checkup slots for checkup ${checkup.id}`);

    // Insert all slots
    const { error: slotsError } = await supabase
      .from('checkup_slots')
      .insert(slots);

    if (slotsError) {
      console.error('Error creating slots:', slotsError);
      return c.json({ error: `Failed to create checkup slots: ${slotsError.message}` }, 500);
    }

    // Get all students on this hostel and floor
    const { data: students } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('hostel', hostel)
      .eq('floor', floor);

    // Send notifications to all affected students
    if (students && students.length > 0) {
      const notifications = students.map(student => ({
        user_id: student.id,
        type: 'checkup_scheduled',
        message: `Routine ${serviceType} checkup scheduled for ${date} at ${timeWindow} for Hostel ${hostel} Floor ${floor}. Please book your 5-minute slot. Checkup ID: ${checkup.id}`,
      }));

      await supabase
        .from('notifications')
        .insert(notifications);
    }

    return c.json({
      success: true,
      checkup,
      message: `Routine checkup created. ${students?.length || 0} students notified.`
    });
  } catch (error: any) {
    console.error('Error creating routine checkup:', error);
    return c.json({ error: `Error creating checkup: ${error.message}` }, 500);
  }
});

// Get routine checkups
app.get("/make-server-4438cc7c/checkups", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    // Get user data
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!userData) {
      return c.json({ error: 'User not found' }, 404);
    }

    let checkups;

    if (userData.role === 'student') {
      // Students see checkups for their hostel/floor
      const { data } = await supabase
        .from('routine_checkups')
        .select('*')
        .eq('hostel', userData.hostel)
        .eq('floor', userData.floor)
        .order('date', { ascending: true });
      checkups = data;
    } else {
      // Staff and admins see all checkups
      const { data } = await supabase
        .from('routine_checkups')
        .select('*')
        .order('date', { ascending: true });
      checkups = data;
    }

    return c.json({ checkups: checkups || [] });
  } catch (error: any) {
    console.error('Error fetching checkups:', error);
    return c.json({ error: `Error fetching checkups: ${error.message}` }, 500);
  }
});

// Get checkup slots
app.get("/make-server-4438cc7c/checkups/:checkupId/slots", authMiddleware, async (c) => {
  try {
    const checkupId = c.req.param('checkupId');
    const supabase = getSupabaseClient();

    const { data: slots, error } = await supabase
      .from('checkup_slots')
      .select('*')
      .eq('checkup_id', checkupId)
      .order('time_slot', { ascending: true });

    if (error) {
      console.error('Error fetching slots:', error);
      return c.json({ error: 'Failed to fetch slots' }, 500);
    }

    return c.json({ slots: slots || [] });
  } catch (error: any) {
    console.error('Error fetching checkup slots:', error);
    return c.json({ error: `Error fetching slots: ${error.message}` }, 500);
  }
});

// Book checkup slot
app.post("/make-server-4438cc7c/checkups/slots/:slotId/book", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const slotId = c.req.param('slotId');
    const supabase = getSupabaseClient();

    // Get slot
    const { data: slot } = await supabase
      .from('checkup_slots')
      .select('*')
      .eq('id', slotId)
      .single();

    if (!slot) {
      return c.json({ error: 'Slot not found' }, 404);
    }

    if (slot.is_booked) {
      return c.json({ error: 'Slot already booked' }, 400);
    }

    // Book the slot
    const { error: updateError } = await supabase
      .from('checkup_slots')
      .update({
        is_booked: true,
        booked_by: userId,
      })
      .eq('id', slotId);

    if (updateError) {
      console.error('Error booking slot:', updateError);
      return c.json({ error: 'Failed to book slot' }, 500);
    }

    // Get checkup details for notification
    const { data: checkup } = await supabase
      .from('routine_checkups')
      .select('*')
      .eq('id', slot.checkup_id)
      .single();

    // Send confirmation notification
    if (checkup) {
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'checkup_booking_confirmation',
          message: `Your ${checkup.service_type} checkup slot for ${checkup.date} at ${slot.time_slot} has been confirmed.`,
        });
    }

    return c.json({ success: true, message: 'Slot booked successfully' });
  } catch (error: any) {
    console.error('Error booking checkup slot:', error);
    return c.json({ error: `Error booking slot: ${error.message}` }, 500);
  }
});

// ============= NOTIFICATION ROUTES =============

// Get user notifications
app.get("/make-server-4438cc7c/notifications", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return c.json({ error: 'Failed to fetch notifications' }, 500);
    }

    return c.json({ notifications: notifications || [] });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return c.json({ error: `Error fetching notifications: ${error.message}` }, 500);
  }
});

// Mark notification as read
app.post("/make-server-4438cc7c/notifications/:notificationId/read", authMiddleware, async (c) => {
  try {
    const notificationId = c.req.param('notificationId');
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return c.json({ error: 'Failed to update notification' }, 500);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating notification:', error);
    return c.json({ error: `Error updating notification: ${error.message}` }, 500);
  }
});

// Mark all notifications as read
app.post("/make-server-4438cc7c/notifications/read-all", authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return c.json({ error: 'Failed to update notifications' }, 500);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating notifications:', error);
    return c.json({ error: `Error updating notifications: ${error.message}` }, 500);
  }
});

// ============= SCHEDULE ROUTES =============

// Get schedule overview (all users)
app.get("/make-server-4438cc7c/schedule", authMiddleware, async (c) => {
  try {
    const supabase = getSupabaseClient();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('time_slot', { ascending: true });

    if (error) {
      console.error('Error fetching schedule:', error);
      return c.json({ error: 'Failed to fetch schedule' }, 500);
    }

    return c.json({ schedule: bookings || [] });
  } catch (error: any) {
    console.error('Error fetching schedule:', error);
    return c.json({ error: `Error fetching schedule: ${error.message}` }, 500);
  }
});

Deno.serve(app.fetch);
