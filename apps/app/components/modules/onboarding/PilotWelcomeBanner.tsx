'use client';

/**
 * Banner de boas-vindas do Projeto Piloto — cria pertencimento no primeiro login.
 * Dismissível (lembra via localStorage). Renderizado no topo do NexoraDashboard.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, PartyPopper, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/auth/useAuth';

const KEY = 'nexora-pilot-welcome-dismissed';

export function PilotWelcomeBanner() {
  const [show, setShow] = useState(false);
  const { org } = useAuth();

  useEffect(() => {
    setShow(localStorage.getItem(KEY) !== '1');
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(KEY, '1');
    setShow(false);
  }

  return (
    <div className="relative rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-4 sm:p-5">
      <button
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute right-3 top-3 text-text-muted hover:text-text-primary"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <PartyPopper size={20} className="mt-0.5 shrink-0 text-brand-gold" />
        <div>
          <p className="font-semibold text-text-primary">Bem-vindo ao Projeto Piloto da Nexora! 🎉</p>
          <p className="mt-1 text-sm text-text-secondary">
            Você faz parte das primeiras clínicas que estão ajudando a construir a plataforma.
            Seu feedback terá impacto direto nas próximas funcionalidades.
          </p>
          {org?.slug && (
            <Link
              href={`/${org.slug}/recuperar`}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-bg hover:bg-brand-gold/90"
            >
              Subir base de pacientes <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
