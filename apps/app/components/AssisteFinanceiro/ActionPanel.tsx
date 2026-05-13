'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ChurnedCustomerResponse } from '@/lib/api/dashboard.api';
import { formatCurrency } from '@/lib/utils/currency';

interface ActionPanelProps {
  customer: ChurnedCustomerResponse;
  onClose: () => void;
}

export function ActionPanel({ customer, onClose }: ActionPanelProps) {
  const [message, setMessage] = useState(customer.suggestedAction?.message || '');

  const handleSendEmail = async () => {
    // Task 6 implementation - placeholder
    console.log('Enviar por email:', { customer, message });
  };

  const handleSendWhatsapp = async () => {
    // Task 6 implementation - placeholder
    console.log('Enviar por WhatsApp:', { customer, message });
  };

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-brand-border">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{customer.name}</h3>
          <p className="text-xs text-text-muted mt-0.5">{customer.email}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-brand-surface-2 transition-colors"
        >
          <X size={18} className="text-text-muted" />
        </button>
      </div>

      {/* Customer Details */}
      <div className="mb-4 p-3 rounded-lg bg-brand-surface-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-tight">Receita</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">
              {formatCurrency(customer.revenue)}
            </p>
          </div>
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-tight">Inativo</p>
            <p className="text-sm font-semibold text-text-primary mt-0.5">
              {customer.daysInactive} dias
            </p>
          </div>
        </div>
      </div>

      {/* Message Editor */}
      <div className="mb-4">
        <label htmlFor="recovery-message" className="text-xs font-medium text-text-muted block mb-2">
          Mensagem de Recuperação
        </label>
        <textarea
          id="recovery-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-brand-border bg-brand-bg text-text-primary text-sm resize-none focus:outline-none focus:border-status-info focus:ring-1 focus:ring-status-info/50"
          rows={4}
          placeholder="Escreva sua mensagem de recuperação..."
        />
        <p className="text-2xs text-text-muted mt-1">
          {message.length} caracteres
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSendEmail}
          className="flex-1 px-3 py-2 rounded-lg bg-status-info hover:bg-status-info/90 text-white text-sm font-medium transition-colors"
        >
          Enviar por Email
        </button>
        <button
          type="button"
          onClick={handleSendWhatsapp}
          className="flex-1 px-3 py-2 rounded-lg bg-status-success hover:bg-status-success/90 text-white text-sm font-medium transition-colors"
        >
          Enviar por WhatsApp
        </button>
      </div>
    </div>
  );
}
