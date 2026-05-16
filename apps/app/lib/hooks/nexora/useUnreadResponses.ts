'use client';

import { useEffect, useState } from 'react';
import { useNexoraResponses } from './useNexoraResponses';

const STORAGE_KEY = 'nexora_responses_last_seen';

/**
 * Counts how many customer responses are "new" (received after the user last
 * visited the responses page).
 *
 * - On the first call ever, marks everything as seen so users aren't slammed
 *   with a giant unread count.
 * - The "last seen" timestamp is stored in localStorage per device.
 * - Call `markAllRead()` from the responses page to clear the badge.
 */
export function useUnreadResponses(): {
  unreadCount: number;
  markAllRead: () => void;
} {
  const { data } = useNexoraResponses();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!data) return;

    const lastSeenRaw =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

    if (!lastSeenRaw) {
      // First time — seed with now so we don't blast the user.
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      }
      setUnreadCount(0);
      return;
    }

    const lastSeen = new Date(lastSeenRaw).getTime();
    const newResponses = data.filter(
      (r) => r.responded && r.respondedAt && new Date(r.respondedAt).getTime() > lastSeen,
    );
    setUnreadCount(newResponses.length);
  }, [data]);

  const markAllRead = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setUnreadCount(0);
  };

  return { unreadCount, markAllRead };
}
