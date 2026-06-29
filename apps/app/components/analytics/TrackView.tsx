'use client';

/** Dispara um evento de funil ao montar. Usado em páginas server (landing, register). */

import { useEffect } from 'react';
import { track, type FunnelEventName } from '@/lib/analytics/track';

export function TrackView({ name }: { name: FunnelEventName }) {
  useEffect(() => {
    track(name);
  }, [name]);
  return null;
}
