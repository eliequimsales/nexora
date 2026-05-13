'use client';

import { QueryProvider } from './QueryProvider';
import { ToastProvider } from './ToastProvider';
import { AuthProvider } from './AuthProvider';
import { Toaster } from '@/components/shared/Toaster';
import { PlanLimitModal } from '@/components/modules/billing/PlanLimitModal';

// Composition order (outer → inner):
// QueryProvider (infra) → ToastProvider → AuthProvider (needs toast for errors)
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ToastProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
        <PlanLimitModal />
      </ToastProvider>
    </QueryProvider>
  );
}
