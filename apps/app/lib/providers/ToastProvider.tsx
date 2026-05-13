'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'ai';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number; // ms, 0 = persistent
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: Omit<Toast, 'id'>): string => {
    const id = Math.random().toString(36).slice(2);
    const duration = options.duration ?? (options.variant === 'error' ? 0 : 4000);

    setToasts((prev) => {
      // max 3 toasts simultâneos — remove o mais antigo
      const next = prev.length >= 3 ? prev.slice(1) : prev;
      return [...next, { ...options, id, duration }];
    });

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
