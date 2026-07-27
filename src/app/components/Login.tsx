import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LogIn, User, Lock, Mail, Building2, Hash, Layers, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (profile: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [roleSelection, setRoleSelection] = useState('student'); // UI selection
  const [roomNumber, setRoomNumber] = useState('');
  const [hostel, setHostel] = useState('H1');
  const [floor, setFloor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch user profile from database
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw new Error('Failed to fetch profile');

      onLoginSuccess(userData);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate student fields
      if (roleSelection === 'student' && (!roomNumber || !hostel || !floor)) {
        throw new Error('Room details are required for students');
      }

      // Map UI selection to database values
      let mappedRole = 'student';
      let staffType = null;

      if (roleSelection === 'student') {
        mappedRole = 'student';
      } else if (roleSelection === 'housekeeping') {
        mappedRole = 'staff';
        staffType = 'housekeeping';
      } else if (roleSelection === 'maintenance') {
        mappedRole = 'staff';
        staffType = 'maintenance';
      } else if (roleSelection === 'routine_checkup') {
        mappedRole = 'staff';
        staffType = 'routine_checkup';
      } else if (roleSelection === 'admin') {
        mappedRole = 'admin';
      }

      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: mappedRole,
            staff_type: staffType,
            room_number: roleSelection === 'student' ? roomNumber : null,
            hostel: roleSelection === 'student' ? hostel : null,
            floor: roleSelection === 'student' ? floor : null,
          }
        }
      });

      if (error) throw error;

      // Insert user into database
      const { error: dbError } = await supabase.from('users').insert({
        id: data.user!.id,
        email: email,
        name: name,
        role: mappedRole,
        staff_type: staffType,
        room_number: roleSelection === 'student' ? roomNumber : null,
        hostel: roleSelection === 'student' ? hostel : null,
        floor: roleSelection === 'student' ? floor : null,
        weekly_booking_count: 0,
        flagged: false,
      });

      if (dbError) throw dbError;

      // Auto sign in after signup
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Fetch user profile
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user!.id)
        .single();

      if (profileError) throw profileError;

      onLoginSuccess(userData);
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-sky-600 to-sky-700 rounded-2xl mb-4 shadow-lg shadow-sky-200">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-800 bg-clip-text text-transparent">
            FixMyRoom
          </h1>
          <p className="text-gray-600 mt-2">
            Hostel Maintenance & Housekeeping Management
          </p>
        </div>

        {/* Login/Signup Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-sky-100 p-8 border border-sky-100">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                !isSignUp
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                isSignUp
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={roleSelection}
                    onChange={(e) => setRoleSelection(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="housekeeping">Housekeeping Staff</option>
                    <option value="maintenance">Maintenance Staff</option>
                    <option value="routine_checkup">Routine Checkup Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {roleSelection === 'student' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hostel
                        </label>
                        <select
                          value={hostel}
                          onChange={(e) => setHostel(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                          required
                        >
                          <option value="H1">H1</option>
                          <option value="H2">H2</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Floor
                        </label>
                        <div className="relative">
                          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={floor}
                            onChange={(e) => setFloor(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                            placeholder="e.g., 3"
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Room Number
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                          placeholder="e.g., 301"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                University Email ID
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                  placeholder="your.email@university.edu"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-600 to-sky-700 text-white py-3 rounded-lg font-medium hover:from-sky-700 hover:to-sky-800 transition-all shadow-lg shadow-sky-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sky-600 font-medium hover:text-sky-700"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
