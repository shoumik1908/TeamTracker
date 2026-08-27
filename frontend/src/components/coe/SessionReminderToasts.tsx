import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/api';

const REMINDER_TYPES = new Set(['COE_SESSION_REMINDER_DAY', 'COE_SESSION_REMINDER_30_MIN']);

export default function SessionReminderToasts() {
  const { data } = useQuery({
    queryKey: ['coe-session-reminder-toasts'],
    queryFn: () => notificationsApi.list({ unreadOnly: 'true', limit: '50' }).then(response => response.data),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  useEffect(() => {
    let clearAllAssigned = false;
    for (const notification of data?.data || []) {
      if (!REMINDER_TYPES.has(notification.type)) continue;
      const storageKey = `coe-reminder-toast:${notification.id}`;
      if (localStorage.getItem(storageKey)) continue;
      toast.info(notification.title, {
        description: notification.message,
        duration: 9000,
        ...(clearAllAssigned ? {} : { action: { label: 'Clear all', onClick: () => toast.dismiss() } }),
      });
      clearAllAssigned = true;
      localStorage.setItem(storageKey, 'shown');
    }
  }, [data]);

  return null;
}
