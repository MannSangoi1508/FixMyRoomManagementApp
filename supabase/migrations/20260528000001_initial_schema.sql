-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (profiles)
CREATE TABLE public.users (
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
CREATE TABLE public.bookings (
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
  photos TEXT[], -- Array of photo URLs
  is_emergency BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_staff UUID REFERENCES public.users(id),
  assigned_staff_name TEXT DEFAULT 'Pending Assignment',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create emergency_slots table
CREATE TABLE public.emergency_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  time_window TEXT NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analytics_logs table
CREATE TABLE public.analytics_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create routine_checkups table
CREATE TABLE public.routine_checkups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hostel TEXT NOT NULL,
  floor TEXT NOT NULL,
  date DATE NOT NULL,
  time_window TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('housekeeping', 'maintenance')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create checkup_slots table
CREATE TABLE public.checkup_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checkup_id UUID NOT NULL REFERENCES public.routine_checkups(id) ON DELETE CASCADE,
  time_slot TEXT NOT NULL,
  is_booked BOOLEAN DEFAULT FALSE,
  booked_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_date ON public.bookings(date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_assigned_staff ON public.bookings(assigned_staff);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_routine_checkups_date ON public.routine_checkups(date);
CREATE INDEX idx_routine_checkups_hostel_floor ON public.routine_checkups(hostel, floor);
CREATE INDEX idx_checkup_slots_checkup_id ON public.checkup_slots(checkup_id);
CREATE INDEX idx_checkup_slots_booked_by ON public.checkup_slots(booked_by);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_checkups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkup_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for bookings table
CREATE POLICY "Students can view their own bookings"
  ON public.bookings FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Students can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students can update their own bookings"
  ON public.bookings FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

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

-- RLS Policies for notifications table
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- RLS Policies for emergency_slots table
CREATE POLICY "Everyone can view emergency slots"
  ON public.emergency_slots FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage emergency slots"
  ON public.emergency_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for analytics_logs table
CREATE POLICY "Admins can view analytics logs"
  ON public.analytics_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create analytics logs"
  ON public.analytics_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies for routine_checkups table
CREATE POLICY "Students can view checkups for their hostel/floor"
  ON public.routine_checkups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND hostel = routine_checkups.hostel AND floor = routine_checkups.floor
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

CREATE POLICY "Admins can create checkups"
  ON public.routine_checkups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage checkups"
  ON public.routine_checkups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for checkup_slots table
CREATE POLICY "Students can view checkup slots"
  ON public.checkup_slots FOR SELECT
  USING (true);

CREATE POLICY "Students can book checkup slots"
  ON public.checkup_slots FOR UPDATE
  USING (
    is_booked = false OR booked_by = auth.uid()
  );

CREATE POLICY "System can create checkup slots"
  ON public.checkup_slots FOR INSERT
  WITH CHECK (true);

-- Function to automatically create user profile after signup
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
$$ LANGUAGE plpgsql;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create notification when booking is created
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
$$ LANGUAGE plpgsql;

-- Trigger for booking notifications
CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.create_booking_notification();

-- Function to create notification when booking status changes
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
$$ LANGUAGE plpgsql;

-- Trigger for booking status change notifications
CREATE TRIGGER on_booking_status_changed
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status_change();

-- Function to reset weekly booking counts (to be called by cron or manually)
CREATE OR REPLACE FUNCTION public.reset_weekly_booking_counts()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET weekly_booking_count = 0,
      last_reset_date = NOW()
  WHERE role = 'student';
END;
$$ LANGUAGE plpgsql;
