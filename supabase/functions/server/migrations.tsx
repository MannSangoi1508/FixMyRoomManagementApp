// Database migrations - run these to set up the schema
export const initialSchemaMigration = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'staff', 'admin')),
  room_number TEXT,
  hostel TEXT,
  floor TEXT,
  weekly_booking_count INTEGER DEFAULT 0,
  last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  hostel TEXT NOT NULL,
  floor TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('housekeeping', 'maintenance')),
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  notes TEXT,
  photos TEXT[],
  is_emergency BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_staff UUID REFERENCES public.users(id),
  assigned_staff_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create emergency_slots table
CREATE TABLE IF NOT EXISTS public.emergency_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  time_window TEXT NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_logs table
CREATE TABLE IF NOT EXISTS public.analytics_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_staff ON public.bookings(assigned_staff);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Students can view their own bookings" ON public.bookings;
CREATE POLICY "Students can view their own bookings"
  ON public.bookings FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

DROP POLICY IF EXISTS "Students can create bookings" ON public.bookings;
CREATE POLICY "Students can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Students can update their own bookings" ON public.bookings;
CREATE POLICY "Students can update their own bookings"
  ON public.bookings FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

DROP POLICY IF EXISTS "Staff can view assigned bookings" ON public.bookings;
CREATE POLICY "Staff can view assigned bookings"
  ON public.bookings FOR SELECT
  USING (
    assigned_staff = auth.uid() OR
    status = 'pending' OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Everyone can view emergency slots" ON public.emergency_slots;
CREATE POLICY "Everyone can view emergency slots"
  ON public.emergency_slots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage emergency slots" ON public.emergency_slots;
CREATE POLICY "Admins can manage emergency slots"
  ON public.emergency_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view analytics logs" ON public.analytics_logs;
CREATE POLICY "Admins can view analytics logs"
  ON public.analytics_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "System can create analytics logs" ON public.analytics_logs;
CREATE POLICY "System can create analytics logs"
  ON public.analytics_logs FOR INSERT
  WITH CHECK (true);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, room_number, hostel, floor)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'room_number',
    NEW.raw_user_meta_data->>'hostel',
    NEW.raw_user_meta_data->>'floor'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_booking_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, booking_id)
  VALUES (
    NEW.user_id,
    'booking_confirmation',
    'Your ' || NEW.service_type || ' booking for ' || NEW.date || ' at ' || NEW.time_slot || ' has been confirmed',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_created ON public.bookings;
CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.create_booking_notification();

CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.notifications (user_id, type, message, booking_id)
    VALUES (
      NEW.user_id,
      'booking_update',
      'Your ' || NEW.service_type || ' booking status updated to: ' || NEW.status,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_status_changed ON public.bookings;
CREATE TRIGGER on_booking_status_changed
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();

CREATE OR REPLACE FUNCTION public.reset_weekly_booking_counts()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET weekly_booking_count = 0,
      last_reset_date = NOW()
  WHERE role = 'student';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

export const seedDataMigration = `
-- Seed emergency slots
INSERT INTO public.emergency_slots (date, time_window, is_available)
SELECT
  CURRENT_DATE + (n || ' days')::interval,
  time_window,
  true
FROM generate_series(0, 7) AS n
CROSS JOIN (
  VALUES
    ('13:00-14:00'),
    ('14:00-15:00'),
    ('15:00-16:00'),
    ('16:00-17:00'),
    ('17:00-18:00'),
    ('18:00-19:00'),
    ('19:00-20:00'),
    ('20:00-21:00')
) AS slots(time_window)
ON CONFLICT DO NOTHING;

-- Add analytics log
INSERT INTO public.analytics_logs (event_type, event_data)
VALUES ('system_initialized', '{"message": "FixMyRoom system initialized", "version": "1.0.0"}')
ON CONFLICT DO NOTHING;
`;
