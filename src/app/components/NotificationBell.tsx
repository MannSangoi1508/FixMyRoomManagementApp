import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Bell, X, CheckCheck } from 'lucide-react';

interface NotificationBellProps {
  userId: string;
  accentColor?: 'sky' | 'purple' | 'orange';
}

export default function NotificationBell({ userId, accentColor = 'sky' }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const accent = {
    sky: { ring: 'ring-sky-200', header: 'bg-sky-600', markAll: 'text-sky-600 hover:text-sky-800' },
    purple: { ring: 'ring-purple-200', header: 'bg-purple-600', markAll: 'text-purple-600 hover:text-purple-800' },
    orange: { ring: 'ring-orange-200', header: 'bg-orange-600', markAll: 'text-orange-600 hover:text-orange-800' },
  }[accentColor];

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`notif-bell-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchNotifications())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  const markAsRead = async (notifId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notifId)
      .eq('user_id', userId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement': return 'Announcement';
      case 'complaint': return 'New Complaint';
      case 'complaint_update': return 'Complaint Update';
      case 'checkup_scheduled': return 'Checkup Scheduled';
      case 'booking_cancelled': return 'Booking Cancelled';
      default: return type?.replace(/_/g, ' ') ?? 'Notification';
    }
  };

  const getTypeDot = (type: string) => {
    switch (type) {
      case 'announcement': return 'bg-sky-500';
      case 'complaint':
      case 'complaint_update': return 'bg-orange-500';
      case 'checkup_scheduled': return 'bg-purple-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 font-bold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 ring-1 ${accent.ring} overflow-hidden`}>
          {/* Header */}
          <div className={`${accent.header} text-white px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span className="font-semibold text-sm">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1.5 bg-white/30 rounded-full px-1.5 py-0.5 text-xs">{unreadCount} new</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-white/80 hover:text-white text-xs flex items-center gap-1 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    !notif.read ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 flex-shrink-0">
                      <span className={`inline-block w-2 h-2 rounded-full ${!notif.read ? getTypeDot(notif.type) : 'bg-gray-200'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-xs font-medium ${!notif.read ? 'text-gray-800' : 'text-gray-500'}`}>
                          {getTypeLabel(notif.type)}
                        </span>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatTime(notif.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm leading-snug ${!notif.read ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                        {notif.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
