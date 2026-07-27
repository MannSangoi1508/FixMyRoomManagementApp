-- Seed Data for Testing

-- Note: Passwords for all test users will be 'password123'
-- These will be created through the signup endpoint

-- Insert emergency slots (1-hour windows)
INSERT INTO public.emergency_slots (date, time_window, is_available) VALUES
  (CURRENT_DATE, '13:00-14:00', true),
  (CURRENT_DATE, '14:00-15:00', true),
  (CURRENT_DATE, '15:00-16:00', true),
  (CURRENT_DATE, '16:00-17:00', true),
  (CURRENT_DATE, '17:00-18:00', true),
  (CURRENT_DATE, '18:00-19:00', true),
  (CURRENT_DATE, '19:00-20:00', true),
  (CURRENT_DATE, '20:00-21:00', true);

-- Insert emergency slots for tomorrow
INSERT INTO public.emergency_slots (date, time_window, is_available) VALUES
  (CURRENT_DATE + INTERVAL '1 day', '13:00-14:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '14:00-15:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '15:00-16:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '16:00-17:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '17:00-18:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '18:00-19:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '19:00-20:00', true),
  (CURRENT_DATE + INTERVAL '1 day', '20:00-21:00', true);

-- Add analytics log entry
INSERT INTO public.analytics_logs (event_type, event_data) VALUES
  ('system_initialized', '{"message": "FixMyRoom system initialized", "version": "1.0.0"}');

-- Instructions for creating test users:
-- Use the signup endpoint or UI to create:
--
-- 1. Student accounts:
--    Email: student1@university.edu, Password: password123
--    Name: John Doe, Role: student, Hostel: A, Floor: 3, Room: 301
--
--    Email: student2@university.edu, Password: password123
--    Name: Jane Smith, Role: student, Hostel: A, Floor: 3, Room: 302
--
--    Email: student3@university.edu, Password: password123
--    Name: Bob Wilson, Role: student, Hostel: B, Floor: 2, Room: 201
--
-- 2. Staff accounts:
--    Email: staff1@university.edu, Password: password123
--    Name: Michael Brown, Role: staff
--
--    Email: staff2@university.edu, Password: password123
--    Name: Sarah Davis, Role: staff
--
-- 3. Admin account:
--    Email: admin@university.edu, Password: password123
--    Name: Admin User, Role: admin
