'use client';

import { useState } from 'react';
import { X, User, Flame, Thermometer, Snowflake, Sparkles, MessageSquare, RefreshCw, Copy, Check, History, ChevronDown, ClipboardList } from 'lucide-react';
import { LeadTimeline } from './LeadTimeline';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { VoiceActionButton, VoiceActionPanel } from '@/components/modules/voice-actions';
import { CreateTaskModal } from '@/components/modules/tasks/CreateTaskModal';
import { useAiAction } from '@/lib/hooks/ai-actions/useAiAction';
import { useUpdateLead } from '@/lib/hooks/leads/useUpdateLead';
import { useCreateNote } from '@/lib/hooks/activity-logs/useCreateNote';
import { useCreateProposal } from '@/lib/hooks/proposals/useCreateProposal';
import { useCreateTask } from '@/lib/hooks/tasks/useCreateTask';
import { useAskCopilot } from '@/lib/hooks/copilot/useAskCopilot';
import { useVoiceActionController } from '@/lib/hooks/voice-actions/useVoiceActionController';
import { formatRelativeTime } from '@/lib/utils';
import type {
  Lead,
  LeadClassification,
  LeadStatus,
  AiActionResult,
  VoiceActionIntent,
} from '@/types';

const STATUS_CONFIG: Record<LeadStatus, { label: string; variant: 'default' | 'info' | 'success' | 'error' | 'warning' }> = {
  new: { label: 'Novo', variant: 'info' },
  contacted: { label: 'Contactado', variant: 'warning' },
  qualified: { label: 'Qualificado', variant: 'success' },
  disqualified: { label: 'Descartado', variant: 'error' },
  closed_won: { label: 'Ganho', variant: 'success' },
  closed_lost: { label: 'Perdido', variant: 'default' },
};

const CLASSIFICATION_CONFIG: Record<LeadClassification, { label: string; icon: React.ElementType; variant: 'amber' | 'warning' | 'default' }> = {
  hot: { label: 'Quente', icon: Flame, variant: 'amber' },
  warm: { label: 'Morno', icon: Thermometer, variant: 'warning' },
  cold: { label: 'Frio', icon: Snowflake, variant: 'default' },
};

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showVoiceActions, setShowVoiceActions] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  function handleResult(label: string) {
    return (data: AiActionResult) => {
      const message = data.result?.message as string | undefined;
      if (message) {
        setGeneratedLabel(label);
        setGeneratedText(message);
      }
    };
  }

  const classify = useAiAction('ai_classify', lead.id);
  const respond = useAiAction('ai_respond', lead.id, { onResult: handleResult('Resposta gerada') });
  const followUp = useAiAction('ai_follow_up', lead.id, { onResult: handleResult('Follow-up gerado') });
  const updateLead = useUpdateLead(lead.id);
  const createNote = useCreateNote(lead.id);
  const createProposal = useCreateProposal();
  const createTask = useCreateTask();
  const askCopilot = useAskCopilot();
  const status = STATUS_CONFIG[lead.status] ?? { label: lead.status, variant: 'default' as const };
  const classification = lead.aiClassification ? CLASSIFICATION_CONFIG[lead.aiClassification] : null;

  const voiceActions = useVoiceActionController({
    context: { lead },
    onExecuteIntent: async (intent: VoiceActionIntent) => {
      switch (intent.type) {
        case 'summarize_lead': {
          const summary = [
            `Lead: ${lead.name}`,
            `Status: ${status.label}`,
            classification ? `Temperatura: ${classification.label}` : null,
            lead.aiScore != null ? `Score: ${lead.aiScore}` : null,
            lead.email ? `Email: ${lead.email}` : null,
            lead.phone ? `Telefone: ${lead.phone}` : null,
            `Origem: ${lead.source}`,
          ]
            .filter(Boolean)
            .join('\n');

          setGeneratedLabel('Resumo gerado');
          setGeneratedText(summary);

          return {
            title: 'Resumo pronto',
            description: 'Resumo interno gerado no modal do lead.',
          };
        }
        case 'classify_lead':
          await classify.mutateAsync();
          return {
            title: 'Classificação disparada',
            description: 'Score e temperatura atualizados pela IA.',
          };
        case 'generate_response':
          await respond.mutateAsync();
          return {
            title: 'Resposta gerada',
            description: 'O texto aparece na seção abaixo.',
          };
        case 'generate_follow_up':
          await followUp.mutateAsync();
          return {
            title: 'Follow-up gerado',
            description: 'O texto aparece na seção abaixo.',
          };
        case 'ask_copilot': {
          const question = intent.transcript;
          const result = await askCopilot.mutateAsync({ leadId: lead.id, question });
          return {
            title: 'Resposta da IA',
            description: result.answer,
          };
        }
        case 'mark_qualified':
          await updateLead.mutateAsync({ status: 'qualified' });
          return {
            title: 'Lead qualificado',
            description: 'Status atualizado para Qualificado.',
          };
        case 'create_note': {
          const content = intent.noteContent ?? intent.transcript;
          await createNote.mutateAsync(content);
          return {
            title: 'Nota registrada ✓',
            description: content,
          };
        }
        case 'move_to_proposal':
          await createProposal.mutateAsync({
            leadId: lead.id,
            title: `Proposta — ${lead.name}`,
            items: [],
          });
          return {
            title: 'Rascunho criado',
            description: 'Proposta criada em rascunho. Acesse Propostas para preencher os itens.',
          };
        case 'create_task': {
          const dueDays = intent.taskDueDays ?? 1;
          const taskTitle = intent.taskTitle ?? 'Tarefa criada por voz';
          const due = new Date();
          due.setDate(due.getDate() + dueDays);
          const dueDate = due.toISOString().slice(0, 10);
          await createTask.mutateAsync({ leadId: lead.id, title: taskTitle, dueDate });
          const prazo = dueDays === 0 ? 'hoje' : dueDays === 1 ? 'amanhã' : `em ${dueDays} dias`;
          return {
            title: 'Tarefa criada ✓',
            description: `"${taskTitle}" — prazo ${prazo}`,
          };
        }
        default:
          throw new Error('Intent não conectada.');
      }
    },
  });

  async function handleCopy() {
    if (!generatedText) return;
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-brand-border bg-brand-surface shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-brand-surface-2 border border-brand-border flex items-center justify-center">
              <User size={16} className="text-text-muted" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{lead.name}</h2>
              <p className="text-xs text-text-muted">{lead.email ?? lead.phone ?? '—'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-brand-surface-2 transition-colors"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Status + classification */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={status.variant} size="sm">{status.label}</Badge>
            {classification && (
              <Badge variant={classification.variant} size="sm">
                <classification.icon size={10} />
                {classification.label}
              </Badge>
            )}
            {lead.aiScore != null && (
              <span className="text-xs text-text-muted">Score: {lead.aiScore}</span>
            )}
            <span className="text-xs text-text-muted ml-auto">{formatRelativeTime(lead.createdAt)}</span>
          </div>

          {/* AI Actions */}
          <div>
            <p className="text-xs font-medium text-text-secondary mb-3">Ações de IA</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={classify.isPending}
                disabled={classify.isPending || respond.isPending || followUp.isPending}
                onClick={() => classify.mutate()}
              >
                <Sparkles size={13} />
                Classificar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={respond.isPending}
                disabled={classify.isPending || respond.isPending || followUp.isPending}
                onClick={() => respond.mutate()}
              >
                <MessageSquare size={13} />
                Gerar resposta
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={followUp.isPending}
                disabled={classify.isPending || respond.isPending || followUp.isPending}
                onClick={() => followUp.mutate()}
              >
                <RefreshCw size={13} />
                Follow-up
              </Button>
              <VoiceActionButton
                active={showVoiceActions}
                onClick={() => setShowVoiceActions((value) => !value)}
              />
            </div>
          </div>

          {showVoiceActions && (
            <VoiceActionPanel
              status={voiceActions.status}
              transcript={voiceActions.transcript}
              suggestions={voiceActions.suggestions}
              intent={voiceActions.intent}
              outcome={voiceActions.outcome}
              errorMessage={voiceActions.errorMessage}
              isSpeechSupported={voiceActions.isSpeechSupported}
              onTranscriptChange={voiceActions.setTranscript}
              onStartListening={voiceActions.startListening}
              onStopListening={voiceActions.stopListening}
              onInterpret={voiceActions.interpretCurrentTranscript}
              onExecute={voiceActions.executeCurrentIntent}
              onReset={voiceActions.reset}
              onApplySuggestion={voiceActions.applySuggestion}
            />
          )}

          {/* Generated text */}
          {generatedText && (
            <div className="rounded-xl border border-brand-border bg-brand-surface-2 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-text-secondary">{generatedLabel}</p>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  {copied ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{generatedText}</p>
            </div>
          )}
          {/* Timeline */}
          <div>
            <button
              onClick={() => setShowTimeline((v) => !v)}
              className="flex items-center justify-between w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <History size={13} className="text-text-muted" />
                <p className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                  Histórico de atividades
                </p>
              </div>
              <ChevronDown
                size={13}
                className={`text-text-muted transition-transform ${showTimeline ? 'rotate-180' : ''}`}
              />
            </button>

            {showTimeline && (
              <div className="mt-3">
                <LeadTimeline leadId={lead.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
