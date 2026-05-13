'use client';

import { Mic, Square, Wand2, AlertCircle, CheckCircle2, Sparkles, ShieldAlert, Lock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type {
  VoiceActionExecutionResult,
  VoiceActionIntent,
  VoiceActionRisk,
  VoiceActionStatus,
  VoiceActionSuggestion,
} from '@/types';

const STATUS_LABELS: Record<VoiceActionStatus, string> = {
  idle: 'Aguardando',
  listening: 'Ouvindo',
  transcribing: 'Processando',
  understanding: 'Interpretando',
  ambiguous: 'Comando ambíguo',
  ready: 'Pronto para executar',
  executing: 'Executando',
  success: 'Concluído',
  error: 'Erro',
};

const EXECUTING_LABELS: Partial<Record<string, string>> = {
  create_task: 'Criando tarefa…',
  create_note: 'Registrando nota…',
  ask_copilot: 'Consultando IA…',
  classify_lead: 'Classificando lead…',
  generate_response: 'Gerando resposta…',
  generate_follow_up: 'Gerando follow-up…',
  summarize_lead: 'Gerando resumo…',
  mark_qualified: 'Atualizando status…',
  move_to_proposal: 'Criando proposta…',
};

const STATUS_VARIANTS: Record<VoiceActionStatus, 'default' | 'info' | 'warning' | 'success' | 'error' | 'ai'> = {
  idle: 'default',
  listening: 'ai',
  transcribing: 'info',
  understanding: 'warning',
  ambiguous: 'warning',
  ready: 'info',
  executing: 'warning',
  success: 'success',
  error: 'error',
};

const RISK_VARIANTS: Record<VoiceActionRisk, 'default' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

interface VoiceActionPanelProps {
  status: VoiceActionStatus;
  transcript: string;
  suggestions: VoiceActionSuggestion[];
  intent: VoiceActionIntent | null;
  outcome: VoiceActionExecutionResult | null;
  errorMessage: string | null;
  isSpeechSupported: boolean;
  onTranscriptChange: (value: string) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onInterpret: () => void;
  onExecute: () => void;
  onReset: () => void;
  onApplySuggestion: (command: string) => void;
}

export function VoiceActionPanel({
  status,
  transcript,
  suggestions,
  intent,
  outcome,
  errorMessage,
  isSpeechSupported,
  onTranscriptChange,
  onStartListening,
  onStopListening,
  onInterpret,
  onExecute,
  onReset,
  onApplySuggestion,
}: VoiceActionPanelProps) {
  const isListening = status === 'listening';
  const isBusy = status === 'understanding' || status === 'executing';
  const canExecute = intent?.availability === 'available' && status === 'ready';
  const executeLabel =
    intent?.executionMode === 'direct' ? 'Executar agora' : 'Confirmar ação';

  const showStatusBar = status !== 'idle';

  return (
    <div className={cn(
      'rounded-xl border bg-brand-surface-2 overflow-hidden transition-all duration-300',
      status === 'listening' ? 'border-brand-amber/40' : 'border-brand-border',
    )}>
      {/* Listening ambient bar */}
      {status === 'listening' && (
        <div className="h-0.5 bg-gradient-to-r from-transparent via-brand-amber to-transparent animate-pulse" />
      )}

      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-text-primary tracking-tight">Comandos de voz</p>
            <p className="text-2xs text-text-muted mt-0.5">
              Fale ou escreva uma instrução — a IA interpreta e age sobre este lead.
            </p>
          </div>
          {showStatusBar && (
            <Badge variant={STATUS_VARIANTS[status]} size="sm" dot={status === 'listening' || status === 'executing'}>
              {status === 'executing' && intent?.type
                ? (EXECUTING_LABELS[intent.type] ?? STATUS_LABELS[status])
                : STATUS_LABELS[status]}
            </Badge>
          )}
        </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={isListening ? 'destructive' : 'secondary'}
          size="sm"
          onClick={isListening ? onStopListening : onStartListening}
          disabled={isBusy}
        >
          {isListening ? <Square size={13} /> : <Mic size={13} />}
          {isListening ? 'Parar escuta' : 'Iniciar escuta'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset} disabled={isBusy}>
          Limpar
        </Button>
      </div>

      {!isSpeechSupported && (
        <div className="rounded-lg border border-status-warning/20 bg-status-warning-muted px-3 py-2 flex gap-2">
          <ShieldAlert size={14} className="text-status-warning shrink-0 mt-0.5" />
          <p className="text-2xs text-status-warning leading-relaxed">
            Captura de voz não disponível neste navegador. Você pode digitar o comando diretamente no campo abaixo.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs font-medium text-text-secondary">Transcrição</p>
          {status === 'listening' && (
            <div className="flex items-center gap-2 text-2xs text-brand-amber font-medium">
              <span className="flex items-end gap-px h-3">
                <span className="w-0.5 rounded-full bg-brand-amber animate-bounce" style={{ height: '6px', animationDelay: '0ms', animationDuration: '600ms' }} />
                <span className="w-0.5 rounded-full bg-brand-amber animate-bounce" style={{ height: '10px', animationDelay: '150ms', animationDuration: '600ms' }} />
                <span className="w-0.5 rounded-full bg-brand-amber animate-bounce" style={{ height: '7px', animationDelay: '75ms', animationDuration: '600ms' }} />
              </span>
              Ouvindo
            </div>
          )}
          {status === 'transcribing' && (
            <div className="flex items-center gap-1.5 text-2xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" />
              Processando
            </div>
          )}
        </div>
        <textarea
          value={transcript}
          onChange={(event) => onTranscriptChange(event.target.value)}
          placeholder="Ex.: resuma este lead, classifique, gere uma resposta..."
          className={cn(
            'w-full min-h-[72px] rounded-xl border bg-brand-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 resize-none',
            isListening
              ? 'border-brand-amber/60 ring-1 ring-brand-amber/25 shadow-sm shadow-brand-amber/10'
              : 'border-brand-border',
          )}
        />
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onInterpret} disabled={!transcript.trim() || isBusy}>
            <Wand2 size={13} />
            Interpretar comando
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-2xs font-medium text-text-secondary">Sugestões do contexto</p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => {
            const isAvailable = suggestion.availability === 'available';
            return (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => isAvailable && onApplySuggestion(suggestion.command)}
                disabled={!isAvailable}
                title={suggestion.reason}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-2xs transition-colors',
                  isAvailable
                    ? 'border-brand-border bg-brand-surface text-text-secondary hover:text-text-primary hover:border-brand-border-2 cursor-pointer'
                    : 'border-brand-border/50 bg-brand-surface/50 text-text-muted cursor-default',
                )}
              >
                {!isAvailable && <Lock size={9} className="opacity-50" />}
                {suggestion.label}
              </button>
            );
          })}
        </div>
      </div>

      {intent && (
        <div className={cn(
          'rounded-xl border p-4 space-y-3 transition-all duration-300',
          status === 'executing'
            ? 'border-brand-amber/60 bg-brand-surface shadow-sm shadow-brand-amber/10 animate-pulse'
            : intent.availability === 'available'
              ? 'border-brand-amber/30 bg-brand-surface'
              : 'border-brand-border bg-brand-surface/60',
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                intent.availability === 'available' ? 'bg-brand-amber/10' : 'bg-brand-surface-2',
              )}>
                {intent.availability === 'available'
                  ? <Zap size={12} className="text-brand-amber" />
                  : <Lock size={12} className="text-text-muted" />}
              </span>
              <div>
                <p className="text-xs font-semibold text-text-primary leading-tight">{intent.label}</p>
                <p className="text-2xs text-text-muted mt-0.5">{intent.description}</p>
              </div>
            </div>
            <Badge variant={RISK_VARIANTS[intent.risk]} size="sm">
              {intent.risk === 'low' ? 'baixo risco' : intent.risk === 'medium' ? 'risco médio' : 'alto risco'}
            </Badge>
          </div>

          <div className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2.5">
            <p className="text-2xs font-medium text-text-secondary mb-1">{intent.previewTitle}</p>
            <p className="text-xs text-text-primary leading-relaxed">
              {intent.previewDescription}
            </p>
          </div>

          {intent.availability === 'available' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onExecute}
              disabled={!canExecute || isBusy}
              className="w-full justify-center"
            >
              <Sparkles size={13} />
              {executeLabel}
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-brand-border/50 bg-brand-surface-2/50 px-3 py-2">
              <Lock size={11} className="text-text-muted shrink-0" />
              <p className="text-2xs text-text-muted">
                Este comando será habilitado em breve.
              </p>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-status-error/25 bg-status-error-muted px-3 py-2.5 flex gap-2.5 items-start">
          <AlertCircle size={13} className="text-status-error shrink-0 mt-0.5" />
          <p className="text-2xs text-status-error leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {outcome && (
        <div className="rounded-xl border border-status-success/20 bg-status-success-muted p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success/15 shrink-0">
              <CheckCircle2 size={13} className="text-status-success" />
            </span>
            <p className="text-xs font-semibold text-status-success">{outcome.title}</p>
          </div>
          {outcome.description && (
            <p className="text-2xs text-status-success/70 leading-relaxed pl-8">{outcome.description}</p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
