import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Calendar, Clock, Sparkles, Wrench, CheckCircle, AlertCircle } from 'lucide-react';

interface CheckupSlotBookingProps {
  checkupId: string;
  checkup: any;
  session: any;
  user: any;
  onClose: () => void;
  onBook?: (slotId: string) => void;
}

export default function CheckupSlotBooking({ checkupId, checkup, session, user, onClose, onBook }: CheckupSlotBookingProps) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [roomAlreadyBooked, setRoomAlreadyBooked] = useState(false);

  useEffect(() => {
    checkRoomLockAndFetchSlots();
  }, []);

  const checkRoomLockAndFetchSlots = async () => {
    try {
      // Check if this room already has a booked slot for this checkup
      const { data: existingSlot, error: lockError } = await supabase
        .from('checkup_slots')
        .select('*')
        .eq('checkup_id', checkupId)
        .eq('room_number', user.room_number)
        .eq('is_booked', true)
        .maybeSingle();

      if (lockError) throw lockError;

      if (existingSlot) {
        setRoomAlreadyBooked(true);
        setLoading(false);
        return;
      }

      // Fetch all slots if room doesn't have a booking
      const { data, error } = await supabase
        .from('checkup_slots')
        .select('*')
        .eq('checkup_id', checkupId)
        .order('time_slot', { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setError('Failed to load slots');
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async (slotId: string, selectedSlot: any) => {
    if (!confirm('Book this checkup slot?')) return;

    // If the parent provided an override handler (e.g. reschedule flow), use it instead
    if (onBook) {
      onBook(slotId);
      return;
    }

    setBooking(true);
    setError('');
    setSuccess('');

    try {
      const { data, error } = await supabase.rpc('book_checkup_slot', {
        p_slot_id: slotId,
        p_student_id: user.id,
        p_room_number: user.room_number,
        p_student_name: user.name,
        p_hostel: user.hostel,
        p_floor: user.floor,
      });

      if (error || !data?.success) {
        setError(data?.error ?? error?.message ?? 'Failed to book slot');
        return;
      }

      setSuccess(`Slot confirmed for ${data.date} at ${data.time_slot}`);

      // Mark checkup notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('type', 'checkup_scheduled');

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to book slot');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl p-8">
          <div className="flex items-center justify-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
            <p className="ml-3 text-gray-600">Loading slots...</p>
          </div>
        </div>
      </div>
    );
  }

  const availableSlots = slots.filter((slot: any) => !slot.is_booked);
  const bookedByMe = slots.find((slot: any) => slot.booked_by === session.user.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full my-8 shadow-2xl">
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Routine Checkup Slots</h2>
              <p className="text-sky-100 mt-1">
                {checkup.service_type === 'housekeeping' ? 'Housekeeping' : 'Maintenance'} Checkup
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Checkup Info */}
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {checkup.service_type === 'housekeeping' ? (
                  <Sparkles className="w-5 h-5 text-sky-600" />
                ) : (
                  <Wrench className="w-5 h-5 text-orange-600" />
                )}
                <span className="text-gray-700 capitalize">{checkup.service_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">{checkup.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">{checkup.time_window}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-700">
                  {availableSlots.length} of {slots.length} slots available
                </span>
              </div>
            </div>
          </div>

          {/* Already Booked Status */}
          {bookedByMe && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-900">You have already booked a slot</p>
                <p className="text-sm text-green-700 mt-1">
                  Your slot: {bookedByMe.time_slot}
                </p>
              </div>
            </div>
          )}

          {/* Available Slots */}
          {availableSlots.length > 0 ? (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Available Time Slots</h3>
              <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto p-2">
                {availableSlots.map((slot: any) => (
                  <button
                    key={slot.id}
                    onClick={() => handleBookSlot(slot.id, slot)}
                    disabled={booking || bookedByMe}
                    className="p-3 border-2 border-sky-200 rounded-lg hover:border-sky-600 hover:bg-sky-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Clock className="w-5 h-5 mx-auto mb-1 text-sky-600" />
                    <p className="text-sm font-medium text-gray-900">{slot.time_slot}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No available slots</p>
              <p className="text-sm text-gray-500 mt-1">
                All slots have been booked for this checkup
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {success}
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
