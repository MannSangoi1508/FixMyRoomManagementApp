import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Calendar, Clock, FileText, Camera, AlertCircle, Sparkles, Wrench, Zap } from 'lucide-react';

interface BookingFormProps {
  user: any;
  session: any;
  onClose: () => void;
  weeklyBookingCount?: number;
}

const EMERGENCY_SLOTS = [
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
  '20:00-21:00',
];

export default function BookingForm({ user, session, onClose, weeklyBookingCount }: BookingFormProps) {
  const [serviceType, setServiceType] = useState('housekeeping');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, { booked_count: number; max_slots: number | null }>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Loading guard - prevent render until user data is available
  if (!user || !session) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  useEffect(() => {
    if (date && serviceType) {
      generateTimeSlots();
      if (!isEmergency) fetchSlotAvailability();
    }
    setTimeSlot('');
    setIsEmergency(false);
  }, [date, serviceType]);

  useEffect(() => {
    if (date && serviceType && !isEmergency) {
      fetchSlotAvailability();
    } else {
      setSlotAvailability({});
    }
    setTimeSlot('');
  }, [isEmergency]);

  useEffect(() => {
    setTimeSlot('');
  }, [isEmergency]);

  const fetchSlotAvailability = async () => {
    if (!date || !serviceType || !user.hostel || !user.floor) return;
    setAvailabilityLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_slot_availability', {
        p_service_type: serviceType,
        p_date: date,
        p_hostel: user.hostel,
        p_floor: user.floor,
      });
      if (!error && data) {
        const map: Record<string, { booked_count: number; max_slots: number | null }> = {};
        (data as any[]).forEach((row) => {
          map[row.time_slot] = { booked_count: row.booked_count, max_slots: row.max_slots };
        });
        setSlotAvailability(map);
      }
    } catch {
      // Non-fatal — fall back to plain slot display
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const now = new Date();
    const selectedDate = new Date(date);
    const isToday = selectedDate.toDateString() === now.toDateString();

    if (serviceType === 'housekeeping') {
      for (let hour = 13; hour < 21; hour++) {
        for (let min = 0; min < 60; min += 15) {
          const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const endHour = min === 45 ? hour + 1 : hour;
          const endMin = min === 45 ? 0 : min + 15;
          const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
          const slotTime = `${startTime}-${endTime}`;

          if (isToday) {
            const slotDateTime = new Date(selectedDate);
            slotDateTime.setHours(hour, min, 0, 0);
            if (slotDateTime <= now) continue;
          }

          slots.push(slotTime);
        }
      }
    } else {
      for (let hour = 9; hour < 21; hour++) {
        for (let min = 0; min < 60; min += 15) {
          const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          const endHour = min === 45 ? hour + 1 : hour;
          const endMin = min === 45 ? 0 : min + 15;
          const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
          const slotTime = `${startTime}-${endTime}`;

          if (isToday) {
            const slotDateTime = new Date(selectedDate);
            slotDateTime.setHours(hour, min, 0, 0);
            if (slotDateTime <= now) continue;
          }

          slots.push(slotTime);
        }
      }
    }

    setAvailableSlots(slots);
  };

  const getFilteredEmergencySlots = () => {
    const now = new Date();
    const selectedDate = new Date(date);
    const isToday = selectedDate.toDateString() === now.toDateString();

    if (!isToday) return EMERGENCY_SLOTS;

    return EMERGENCY_SLOTS.filter(slot => {
      const [startTime] = slot.split('-');
      const [hour, min] = startTime.split(':').map(Number);
      const slotDateTime = new Date(selectedDate);
      slotDateTime.setHours(hour, min, 0, 0);
      return slotDateTime > now;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setSelectedFiles([...selectedFiles, ...newFiles]);

      const readers: Promise<string>[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        const promise = new Promise<string>((resolve) => {
          reader.onload = (event) => {
            if (event.target?.result) resolve(event.target.result as string);
          };
          reader.readAsDataURL(file);
        });
        readers.push(promise);
      }
      Promise.all(readers).then((results) => setPhotos([...photos, ...results]));
    }
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from('booking-photos')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('booking-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Null-safe field extraction
      const selectedServiceType = serviceType ?? '';
      const selectedDate = date ?? '';
      const selectedTimeSlot = timeSlot ?? '';
      const bookingNotes = notes ?? '';

      // Validate required fields
      if (!selectedServiceType) {
        throw new Error('Please select a service type');
      }

      if (!selectedDate) {
        throw new Error('Please select a date');
      }

      if (!selectedTimeSlot) {
        throw new Error('Please select a time slot');
      }

      // Validate that selected datetime is not in the past
      const now = new Date();
      const selectedDateTime = new Date(selectedDate);
      const [startTime] = selectedTimeSlot.split('-');
      const [hour, min] = startTime.split(':').map(Number);
      selectedDateTime.setHours(hour, min, 0, 0);

      if (selectedDateTime <= now) {
        throw new Error('Booking failed: the selected slot has already passed.');
      }

      // Emergency bookings are automatically housekeeping
      const finalServiceType = isEmergency ? 'housekeeping' : selectedServiceType;

      // Upload photos if any
      const uploadedPhotoUrls = selectedFiles.length > 0
        ? await Promise.all(selectedFiles.map(uploadPhoto))
        : [];

      // Call RPC function to create booking
      const { data, error: rpcError } = await supabase.rpc('create_booking', {
        p_user_id: user.id,
        p_user_name: user.name,
        p_room_number: user.room_number,
        p_hostel: user.hostel,
        p_floor: user.floor,
        p_service_type: finalServiceType,
        p_date: selectedDate,
        p_time_slot: selectedTimeSlot,
        p_notes: bookingNotes,
        p_is_emergency: isEmergency ?? false,
        p_photos: uploadedPhotoUrls
      });

      if (rpcError || !data?.success) {
        const errorMessage = data?.error ?? rpcError?.message ?? 'Booking failed';
        throw new Error(errorMessage);
      }

      alert('Booking created successfully!');
      onClose();
    } catch (err: any) {
      console.error('=== BOOKING SUBMISSION ERROR ===');
      console.error('Error:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      setError(err.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const slotsToDisplay = isEmergency ? getFilteredEmergencySlots() : availableSlots;
  const canSubmit = !!timeSlot && !!serviceType && !!date;

  // Debug log whenever state changes
  useEffect(() => {
    console.log('State changed - Current values:');
    console.log('  serviceType:', serviceType);
    console.log('  date:', date);
    console.log('  timeSlot:', timeSlot);
    console.log('  canSubmit:', canSubmit);
  }, [serviceType, date, timeSlot, canSubmit]);
  const hasUsedWeeklyBooking = (weeklyBookingCount ?? user.weekly_booking_count ?? 0) >= 1;
  const canUseEmergency = serviceType === 'housekeeping' && hasUsedWeeklyBooking;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-2xl">
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">New Booking</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sky-100 mt-1">Request housekeeping or maintenance service</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Service Type - hidden when emergency mode is active */}
          {!isEmergency && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setServiceType('housekeeping');
                  }}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    serviceType === 'housekeeping' ? 'border-sky-600 bg-sky-50' : 'border-gray-200 hover:border-sky-300'
                  }`}
                >
                  <Sparkles className="w-6 h-6 text-sky-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Housekeeping</p>
                    <p className="text-xs text-gray-500">1/week • 1 PM – 9 PM</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServiceType('maintenance');
                  }}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    serviceType === 'maintenance' ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <Wrench className="w-6 h-6 text-orange-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Maintenance</p>
                    <p className="text-xs text-gray-500">Unlimited • 9 AM – 9 PM</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Emergency mode indicator */}
          {isEmergency && (
            <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-900">Emergency Housekeeping Booking</p>
                  <p className="text-xs text-red-700 mt-1">1-hour window slots • Same-day service</p>
                </div>
              </div>
            </div>
          )}

          {/* Emergency toggle — only for housekeeping after weekly booking is used */}
          {serviceType === 'housekeeping' && (
            canUseEmergency ? (
              <div className="flex items-center gap-3 p-3 border border-red-200 bg-red-50 rounded-lg">
                <Zap className="w-5 h-5 text-red-600 flex-shrink-0" />
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={isEmergency}
                    onChange={(e) => setIsEmergency(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                  <span className="text-sm font-medium text-red-700">Emergency Booking (1-hour window slots)</span>
                </label>
              </div>
            ) : (
              <div className="p-3 border border-sky-200 bg-sky-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
                  <p className="text-sm text-sky-700">
                    Use your weekly booking first before accessing emergency slots
                  </p>
                </div>
              </div>
            )
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                max={(() => {
                  const maxDate = new Date();
                  maxDate.setDate(maxDate.getDate() + 7);
                  return maxDate.toISOString().split('T')[0];
                })()}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none"
                required
              />
            </div>
          </div>

          {/* Time Slot */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {isEmergency ? 'Emergency Time Window (1-hour)' : 'Time Slot'}
              </label>
              {availabilityLoading && (
                <span className="text-xs text-gray-400">Loading availability…</span>
              )}
            </div>
            {slotsToDisplay.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                {slotsToDisplay.map((slot) => {
                  const avail = slotAvailability[slot];
                  const isFull = avail && avail.max_slots !== null && avail.booked_count >= avail.max_slots;
                  const isSelected = timeSlot === slot;

                  let availLabel: JSX.Element | null = null;
                  if (!isEmergency && avail) {
                    if (avail.max_slots === null) {
                      availLabel = <span className="text-xs text-green-600 font-medium">Available</span>;
                    } else if (isFull) {
                      availLabel = <span className="text-xs text-red-600 font-medium">Full</span>;
                    } else {
                      const remaining = avail.max_slots - avail.booked_count;
                      availLabel = (
                        <span className="text-xs text-green-600 font-medium">
                          {remaining}/{avail.max_slots} left
                        </span>
                      );
                    }
                  }

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!!isFull}
                      onClick={() => setTimeSlot(slot)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5 ${
                        isFull
                          ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? isEmergency
                            ? 'border-red-600 bg-red-50 text-red-700'
                            : 'border-sky-600 bg-sky-50 text-sky-700'
                          : 'border-gray-200 hover:border-sky-300 text-gray-700'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>{slot}</span>
                      {availLabel}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No available slots for this date</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-600 focus:border-transparent outline-none resize-none"
                rows={3}
                placeholder="Add any specific requirements or details..."
              />
            </div>
          </div>

          {/* Photo Upload for Maintenance */}
          {serviceType === 'maintenance' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photos (Optional)</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <label className="cursor-pointer">
                  <span className="text-sky-600 font-medium hover:text-sky-700">Choose photos</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </label>
                <p className="text-xs text-gray-500 mt-1">Upload images of the issue</p>
              </div>
              {photos.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img src={photo} alt={`Upload ${index + 1}`} className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotos(photos.filter((_, i) => i !== index));
                          setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation warning when fields are missing */}
          {!canSubmit && !loading && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>
                Please select:
                {!serviceType && ' Service Type'}
                {!serviceType && (!date || !timeSlot) && ','}
                {!date && ' Date'}
                {!date && !timeSlot && ','}
                {!timeSlot && ' Time Slot'}
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 text-white rounded-lg hover:from-sky-700 hover:to-sky-800 transition-all shadow-lg shadow-sky-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title={!canSubmit ? 'Please complete all required fields' : 'Submit booking'}
            >
              {loading ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
