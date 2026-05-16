'use client';

import { useState } from 'react';
import { MessageSquare, CheckCircle2, Clock, ArrowRight, Filter } from 'lucide-react';
import { useNexoraResponses } from '@/lib/hooks/nexora/useNexoraResponses';

type ResponseStatus = 'responded' | 'no-response' | 'all';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface RecoveryResponseItem {
  id: string;
  leadId: string;
  leadName: string;
  channel: 'whatsapp' | 'email';
  sentAt: string;
  respondedAt?: string;
  responded: boolean;
  message: string;
  response?: string;
  phone?: string;
  email?: string;
}

export function NexoraResponses() {
  const [filter, setFilter] = useState<ResponseStatus>('all');
  const { data, isLoading } = useNexoraResponses();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-brand-surface rounded-lg skeleton" />
        ))}
      </div>
    );
  }

  // Mock data for demonstration
  const mockResponses: RecoveryResponseItem[] = [
    {
      id: '1',
      leadId: 'lead-1',
      leadName: 'João Silva',
      channel: 'whatsapp',
      sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      respondedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
      responded: true,
      message: 'Oi João, saudades suas! 👋 Que tal voltar para uma hidratação?',
      response: 'Oi! Tudo bem? Quero sim, quando você tem disponibilidade?',
      phone: '(11) 99999-8888',
    },
    {
      id: '2',
      leadId: 'lead-2',
      leadName: 'Maria Santos',
      channel: 'email',
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      responded: false,
      message: 'Volta para nós, Maria! Temos 20% de desconto esperando por você.',
      email: 'maria@email.com',
    },
    {
      id: '3',
      leadId: 'lead-3',
      leadName: 'Carlos Mendes',
      channel: 'whatsapp',
      sentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      respondedAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(),
      responded: true,
      message: 'Oi Carlos! Temos um novo serviço que você pode gostar.',
      response: 'Manda os detalhes aí! Qual é o horário de funcionamento?',
      phone: '(11) 98888-7777',
    },
  ];

  const responses = data || mockResponses;

  // Filter responses
  const filteredResponses =
    filter === 'all'
      ? responses
      : filter === 'responded'
        ? responses.filter((r) => r.responded)
        : responses.filter((r) => !r.responded);

  const stats = {
    total: responses.length,
    responded: responses.filter((r) => r.responded).length,
    noResponse: responses.filter((r) => !r.responded).length,
  };

  const responseRate = stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Respostas de Clientes</h1>
        <p className="text-sm text-text-muted">
          Acompanhe as respostas dos clientes às mensagens de recuperação.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-medium text-text-muted uppercase mb-1">Total de Respostas</p>
          <p className="text-2xl font-bold text-text-primary">{stats.responded}</p>
          <p className="text-xs text-text-muted mt-1">de {stats.total} tentativas</p>
        </div>
        <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-medium text-text-muted uppercase mb-1">Taxa de Resposta</p>
          <p className="text-2xl font-bold text-brand-gold">{responseRate}%</p>
          <p className="text-xs text-text-muted mt-1">Clientes que responderam</p>
        </div>
        <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
          <p className="text-xs font-medium text-text-muted uppercase mb-1">Sem Resposta</p>
          <p className="text-2xl font-bold text-text-primary">{stats.noResponse}</p>
          <p className="text-xs text-text-muted mt-1">Aguardando resposta</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-text-muted" />
        <div className="flex gap-2">
          {(['all', 'responded', 'no-response'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === status
                  ? 'bg-brand-gold text-brand-bg'
                  : 'bg-brand-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              {status === 'all'
                ? 'Todas'
                : status === 'responded'
                  ? 'Com Resposta'
                  : 'Sem Resposta'}
            </button>
          ))}
        </div>
      </div>

      {/* Responses List */}
      <div className="space-y-3">
        {filteredResponses.length > 0 ? (
          filteredResponses.map((response) => (
            <div
              key={response.id}
              className="rounded-lg border border-brand-border bg-brand-surface p-4 hover:bg-brand-surface-2 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-text-primary">{response.leadName}</p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        response.responded
                          ? 'bg-status-success-muted text-status-success'
                          : 'bg-status-warning-muted text-status-warning'
                      }`}
                    >
                      {response.responded ? (
                        <>
                          <CheckCircle2 size={12} />
                          Respondeu
                        </>
                      ) : (
                        <>
                          <Clock size={12} />
                          Aguardando
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">
                    {response.channel === 'whatsapp' ? '💬 WhatsApp' : '📧 Email'} •{' '}
                    {response.phone || response.email}
                  </p>
                </div>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-brand-surface-2 hover:bg-brand-border transition-colors flex items-center gap-1">
                  <MessageSquare size={12} />
                  Ver
                </button>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                {/* Sent */}
                <div className="flex gap-3 text-xs">
                  <div className="w-16 pt-0.5">
                    <span className="text-text-muted">Enviado</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-text-secondary truncate">{response.message}</p>
                    <p className="text-2xs text-text-muted mt-0.5">{formatDate(response.sentAt)}</p>
                  </div>
                </div>

                {/* Response */}
                {response.responded && response.respondedAt && (
                  <div className="flex gap-3 text-xs mt-2 pt-2 border-t border-brand-border">
                    <div className="w-16 pt-0.5">
                      <span className="text-text-muted">Resposta</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-text-secondary">{response.response}</p>
                      <p className="text-2xs text-text-muted mt-0.5">{formatDate(response.respondedAt)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              {response.responded && (
                <div className="mt-3 pt-3 border-t border-brand-border flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-gold text-brand-bg hover:bg-brand-gold/90 transition-colors">
                    <ArrowRight size={12} />
                    Próxima Ação
                  </button>
                  <button className="flex-1 text-xs font-medium rounded-lg bg-brand-surface-2 hover:bg-brand-border transition-colors px-3 py-1.5">
                    Fechar Recuperação
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <MessageSquare size={32} className="text-text-muted mx-auto mb-2" />
            <p className="text-text-muted">Nenhuma resposta neste filtro</p>
          </div>
        )}
      </div>
    </div>
  );
}
