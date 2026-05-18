'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Send, Zap, ChevronDown } from 'lucide-react';
import { useBatchRecovery } from '@/lib/hooks/nexora/useBatchRecovery';
import { useInactiveClientsQuery } from '@/lib/hooks/leads/useInactiveClientsQuery';

export function NexoraBatchRecovery() {
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [filterDays, setFilterDays] = useState(30);
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email'>('all');
  const [showPreview, setShowPreview] = useState(false);
  const { mutate, isPending, isSuccess, selected, failed, skipped } = useBatchRecovery();
  const { data: inactiveClients, isLoading: isLoadingClients } = useInactiveClientsQuery(filterDays);

  const whatsappVar = '{{customer_name}}';

  // Map inactive clients from API to UI shape (api returns InactiveClient)
  const allCustomers = (inactiveClients ?? []).map((client) => ({
    id: client.id,
    leadId: client.id,
    leadName: client.name,
    phone: client.phone || undefined,
    email: client.email || undefined,
    daysInactive: client.daysSinceLastActivity,
  }));

  // Filter customers by channel availability (days filter is applied via the query)
  const filteredCustomers = allCustomers.filter(
    (c) =>
      channelFilter === 'all' ||
      (channelFilter === 'whatsapp' && c.phone) ||
      (channelFilter === 'email' && c.email),
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(new Set(filteredCustomers.map((c) => c.id)));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedCustomers(newSelected);
  };

  const handleBatchRecovery = () => {
    mutate({
      leadIds: Array.from(selectedCustomers).map((id) => {
        const customer = filteredCustomers.find((c) => c.id === id);
        return customer?.leadId || '';
      }),
      channels: channelFilter === 'all' ? ['whatsapp', 'email'] : [channelFilter],
    });
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Recuperação em Lote</h1>
        <p className="text-sm text-text-muted">
          Envie mensagens de recuperação para múltiplos clientes inativos de uma vez.
        </p>
      </div>

      {/* Success message */}
      {isSuccess && (
        <div className="rounded-lg border border-status-success-border bg-status-success-muted p-4 flex gap-3">
          <CheckCircle2 size={16} className="text-status-success shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-status-success">Campanha enviada</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-text-muted">Enviadas: </span>
                <span className="font-semibold text-status-success">{selected}</span>
              </div>
              {skipped > 0 && (
                <div>
                  <span className="text-text-muted">Pularam (opt-out): </span>
                  <span className="font-semibold text-text-secondary">{skipped}</span>
                </div>
              )}
              {failed > 0 && (
                <div>
                  <span className="text-text-muted">Falharam: </span>
                  <span className="font-semibold text-status-error">{failed}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Days filter */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-2">
              Dias sem atividade
            </label>
            <input
              type="range"
              min="1"
              max="180"
              value={filterDays}
              onChange={(e) => setFilterDays(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-text-primary font-medium mt-2">{filterDays}+ dias</p>
          </div>

          {/* Channel filter */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-2">
              Canal
            </label>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-brand-border rounded-lg bg-brand-surface-2 text-text-primary text-sm"
            >
              <option value="all">Todos os canais</option>
              <option value="whatsapp">Apenas WhatsApp</option>
              <option value="email">Apenas Email</option>
            </select>
          </div>

          {/* Stats */}
          <div className="rounded-lg bg-brand-surface-2 p-3">
            <p className="text-xs font-semibold text-text-muted uppercase mb-1">Clientes encontrados</p>
            <p className="text-2xl font-bold text-text-primary">{filteredCustomers.length}</p>
            <p className="text-xs text-text-muted mt-1">{selectedCustomers.size} selecionados</p>
          </div>
        </div>
      </div>

      {/* Customer list */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Clientes inativos</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs text-text-muted">Selecionar todos</span>
          </label>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {isLoadingClients ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-brand-surface-2 skeleton" />
            ))
          ) : filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-brand-surface-2 hover:bg-brand-border transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCustomers.has(customer.id)}
                  onChange={(e) => handleSelectCustomer(customer.id, e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary">{customer.leadName}</p>
                  <p className="text-xs text-text-muted">
                    {customer.phone && <span>📱 {customer.phone}</span>}
                    {customer.email && <span>{customer.phone ? ' • ' : ''}📧 {customer.email}</span>}
                    <span className="ml-2 text-status-warning">{customer.daysInactive} dias inativo</span>
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <AlertCircle size={24} className="text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">Nenhum cliente encontrado com os filtros aplicados</p>
            </div>
          )}
        </div>
      </div>

      {/* Preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="flex items-center gap-2 text-sm text-brand-gold hover:text-brand-gold/80"
      >
        <ChevronDown size={16} className={`transition-transform ${showPreview ? 'rotate-180' : ''}`} />
        Visualizar mensagens
      </button>

      {/* Message preview */}
      {showPreview && (
        <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-4">
          <p className="text-xs font-semibold text-text-muted uppercase mb-3">Preview de mensagens</p>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-brand-surface text-text-secondary">
              <p className="font-medium mb-1">💬 WhatsApp:</p>
              <p>"Oi {whatsappVar}, saudades suas! 👋 Que tal voltar para uma hidratação?"</p>
            </div>
            <div className="p-2 rounded bg-brand-surface text-text-secondary">
              <p className="font-medium mb-1">📧 Email:</p>
              <p>"Volta para nós! Temos uma oferta especial de 20% de desconto esperando por você."</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleBatchRecovery}
          disabled={selectedCustomers.size === 0 || isPending}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={16} />
          {isPending ? 'Enviando...' : `Enviar para ${selectedCustomers.size} clientes`}
        </button>
        <button
          onClick={() => setSelectedCustomers(new Set())}
          className="px-6 py-3 border border-brand-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
        >
          Limpar
        </button>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-status-info-muted p-4 flex gap-3">
        <Zap size={16} className="text-status-info shrink-0 mt-0.5" />
        <div className="text-sm text-status-info">
          <p className="font-medium mb-1">💡 Dica</p>
          <p>
            As mensagens serão personalizadas com o nome de cada cliente. Clientes que responderam
            recentemente não receberão duplicatas.
          </p>
        </div>
      </div>
    </div>
  );
}
