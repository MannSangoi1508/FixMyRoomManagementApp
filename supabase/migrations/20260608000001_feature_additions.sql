-- Add flagged columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('students', 'staff', 'both')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  user_name TEXT NOT NULL,
  room_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Complaint', 'Feedback')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create complaint_comments table
CREATE TABLE IF NOT EXISTS public.complaint_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create staff_attendance table
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.users(id) NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  marked_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Create admin_activity_log table
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add slot_duration to routine_checkups table
ALTER TABLE public.routine_checkups
  ADD COLUMN IF NOT EXISTS slot_duration INTEGER DEFAULT 5;

-- Add cancelled_at to checkup_slots
ALTER TABLE public.checkup_slots
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create function for custom slot generation
CREATE OR REPLACE FUNCTION public.generate_checkup_slots_custom(
  p_checkup_id UUID,
  p_start_time TEXT,
  p_slot_duration INTEGER
)
RETURNS json AS $$
DECLARE
  v_time TIME;
  v_slot_time TEXT;
  i INTEGER;
BEGIN
  v_time := p_start_time::TIME;

  FOR i IN 1..32 LOOP
    v_slot_time := v_time::TEXT;

    INSERT INTO public.checkup_slots (checkup_id, time_slot, is_booked, is_cancelled)
    VALUES (p_checkup_id, v_slot_time, false, false);

    v_time := v_time + (p_slot_duration || ' minutes')::INTERVAL;
  END LOOP;

  RETURN json_build_object('success', true, 'slots_created', 32);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admin can insert announcements" ON public.announcements FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own complaints" ON public.complaints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own complaints" ON public.complaints FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view complaint comments" ON public.complaint_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert complaint comments" ON public.complaint_comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view attendance" ON public.staff_attendance FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attendance" ON public.staff_attendance FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view activity log" ON public.admin_activity_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert activity log" ON public.admin_activity_log FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
