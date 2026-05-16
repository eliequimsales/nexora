'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Send,
  Mail,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/providers/ToastProvider';
import { useRecoverClientMutation } from '@/lib/hooks/leads/useRecoverClientMutation';
import type { InactiveClient, RecoveryChannel, RecoveryResult } from '@/types';

interface RecoveryModalProps {
  client: InactiveClient | null;
  onClose: () => void;
}

/**
 * Modal de confirmação de recuperação de cliente.
 *
 * Fluxo:
 *  - exibe destinatário e canal (auto-detectado, mutável se o cliente tem
 *    ambos os contatos)
 *  - dispara `POST /leads/:id/recuperar` ao confirmar
 *  - mostra preview da mensagem gerada pela IA em sucesso
 *  - exibe erro inline em falha (sem fechar)
 */
export function RecoveryModal({ client, onClose }: RecoveryModalProps) {
  const { toast } = useToast();
  const mutation = useRecoverClientMutation();
  const [channel, setChannel] = useState<RecoveryChannel | null>(null);
  const [result, setResult] = useState<RecoveryResult | null>(null);

  // Define canal default toda vez que o cliente muda.
  useEffect(() => {
    if (!client) {
      setChannel(null);
      setResult(null);
      return;
    }
    if (client.phone) setChannel('whatsapp');
    else if (client.email) setChannel('email');
    else setChannel(null);
    setResult(null);
  }, [client]);

  // Esc fecha o modal — só quando não estiver enviando.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !mutation.isPending) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mutation.isPending, onClose]);

  if (!client) return null;

  const hasWhats = Boolean(client.phone);
  const hasEmail = Boolean(client.email);
  const canSend = channel !== null;
  const recipient =
    channel === 'whatsapp' ? client.phone : channel === 'email' ? client.email : null;

  function handleConfirm() {
    if (!client || !channel) return;
    mutation.mutate(
      { leadId: client.id, channel },
      {
        onSuccess: (data) => {
          setResult(data);
          if (data.success) {
            const firstName = client.name.split(' ')[0];
            toast({
              variant: 'success',
              title: `${firstName} voltou pro radar! 🎉`,
              description: 'Mensagem enviada com sucesso.',
            });
          } else {
            toast({
              variant: 'error',
              title: 'Falha ao enviar mensagem',
              description: data.error ?? 'Tente novamente em instantes.',
            });
          }
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message ??
            err?.message ??
            'Não conseguimos enviar agora. Tente novamente.';
          toast({
            variant: 'error',
            title: 'Erro ao recuperar cliente',
            description: msg,
          });
        },
      },
    );
  }

  function handleClose() {
    if (mutation.isPending) return;
    onClose();
  }

  // Em sucesso (após envio) — tela de confirmação com preview da mensagem
  if (result?.success) {
    return (
      <ModalShell onClose={handleClose}>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-status-success-muted flex items-center justify-center mb-3">
            <CheckCircle2 size={24} className="text-status-success" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Mensagem enviada!
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {client.name} recebeu via {result.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-brand-border bg-brand-surface-2/40 p-4">
          <div className="flex items-center gap-2 mb-2 text-2xs uppercase tracking-wider text-text-muted">
            <Sparkles size={11} className="text-brand-gold" />
            Mensagem gerada pela Nexora
          </div>
          <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
            {result.message}
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="mt-5 w-full rounded-lg bg-brand-surface-2 border border-brand-border text-sm font-medium text-text-primary py-2.5 hover:bg-brand-surface-3 transition-colors"
        >
          Fechar
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={handleClose}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-purple/15 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-brand-purple" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">
            Recuperar {client.name}?
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            A Nexora vai gerar uma mensagem personalizada com IA e enviar
            agora mesmo.
          </p>
        </div>
      </div>

      {/* Escolha de canal */}
      <div className="mt-5">
        <p className="text-2xs uppercase tracking-wider text-text-muted mb-2">
          Canal de envio
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ChannelOption
            label="WhatsApp"
            icon={MessageCircle}
            active={channel === 'whatsapp'}
            disabled={!hasWhats}
            onClick={() => hasWhats && setChannel('whatsapp')}
            detail={client.phone ?? 'sem telefone'}
          />
          <ChannelOption
            label="Email"
            icon={Mail}
            active={channel === 'email'}
            disabled={!hasEmail}
            onClick={() => hasEmail && setChannel('email')}
            detail={client.email ?? 'sem email'}
          />
        </div>
      </div>

      {/* Destinatário escolhido */}
      {recipient && (
        <p className="mt-4 text-xs text-text-muted">
          Enviar para{' '}
          <span className="text-text-primary font-medium">{recipient}</span>
        </p>
      )}

      {/* Erro do envio anterior (caso o backend tenha retornado success:false) */}
      {result && !result.success && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-error/30 bg-status-error-muted/40 p-3">
          <AlertTriangle size={14} className="text-status-error mt-0.5 shrink-0" />
          <div className="text-xs text-status-error">
            <p className="font-medium">Não foi possível enviar</p>
            <p className="mt-0.5 opacity-90">
              {result.error ?? 'Tente novamente em instantes.'}
            </p>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={mutation.isPending}
          className="flex-1 rounded-lg border border-brand-border bg-brand-surface-2 text-sm font-medium text-text-secondary py-2.5 hover:bg-brand-surface-3 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canSend || mutation.isPending}
          className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gold text-brand-bg text-sm font-semibold py-2.5 hover:bg-brand-gold/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:bg-brand-gold disabled:active:scale-100"
        >
          {mutation.isPending ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Send size={14} />
              Enviar agora
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}

interface ModalShellProps {
  children: React.ReactNode;
  onClose: () => void;
}

function ModalShell({ children, onClose }: ModalShellProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

interface ChannelOptionProps {
  label: string;
  icon: React.ElementType;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  detail: string;
}

function ChannelOption({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
  detail,
}: ChannelOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all',
        active
          ? 'border-brand-gold bg-brand-amber-muted/30 text-text-primary'
          : 'border-brand-border bg-brand-surface-2/40 text-text-secondary hover:border-brand-border-2 hover:bg-brand-surface-2',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-brand-surface-2/40 hover:border-brand-border',
      )}
    >
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Icon size={14} />
        {label}
      </div>
      <span className="text-2xs text-text-muted truncate w-full">
        {detail}
      </span>
    </button>
  );
}
