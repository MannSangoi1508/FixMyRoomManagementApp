import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import HousekeepingDashboard from './components/HousekeepingDashboard';
import MaintenanceDashboard from './components/MaintenanceDashboard';
import RoutineCheckupDashboard from './components/RoutineCheckupDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-sky-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !userProfile) {
    return <Login onLoginSuccess={(profile) => setUserProfile(profile)} />;
  }

  // Route to appropriate dashboard based on user role
  if (userProfile.role === 'student') {
    return <StudentDashboard user={userProfile} session={session} onSignOut={handleSignOut} />;
  } else if (userProfile.role === 'staff') {
    // Route staff to specific dashboard based on staff_type
    const staffType = userProfile.staff_type || userProfile.staffType || 'housekeeping';
    if (staffType === 'housekeeping') {
      return <HousekeepingDashboard user={userProfile} session={session} onSignOut={handleSignOut} />;
    } else if (staffType === 'maintenance') {
      return <MaintenanceDashboard user={userProfile} session={session} onSignOut={handleSignOut} />;
    } else if (staffType === 'routine_checkup') {
      return <RoutineCheckupDashboard user={userProfile} session={session} onSignOut={handleSignOut} />;
    }
    // Default to housekeeping if staff_type is not set
    return <HousekeepingDashboard user={userProfile} session={session} onSignOut={handleSignOut} />;
  } else if (userProfile.role === 'admin') {
    return <AdminDashboard user={userProfile} session={session} onSignOut={handleSignOut} />;
  }

  return null;
}
