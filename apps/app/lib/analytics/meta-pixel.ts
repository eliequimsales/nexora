/**
 * Meta (Facebook) Pixel — só pra OTIMIZAÇÃO de anúncios.
 * A fonte da verdade do produto é o analytics interno (lib/analytics/track).
 * No-op se NEXT_PUBLIC_FB_PIXEL_ID não estiver setado (seguro em dev/sem pixel).
 */

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

type FbEvent = 'PageView' | 'CompleteRegistration' | 'Lead' | 'Contact' | 'SubmitApplication';

export function fbqTrack(event: FbEvent, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq === 'function') fbq('track', event, params);
}
