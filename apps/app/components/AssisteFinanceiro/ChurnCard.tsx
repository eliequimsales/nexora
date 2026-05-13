'use client';

import type { ChurnedCustomerResponse } from '@/lib/api/dashboard.api';
import { formatCurrency } from '@/lib/utils/currency';

interface ChurnCardProps {
  customers: ChurnedCustomerResponse[];
  onSelectCustomer: (customer: ChurnedCustomerResponse) => void;
}

export function ChurnCard({ customers, onSelectCustomer }: ChurnCardProps) {

  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Clientes em Risco</h3>
        <div className="py-8 text-center">
          <p className="text-sm text-text-muted">Nenhum cliente em risco</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Clientes em Risco ({customers.length})</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {customers.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => onSelectCustomer(customer)}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-2 hover:border-brand-border-hover focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-status-info transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{customer.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Inativo há {customer.daysInactive} dias
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium text-text-primary">
                  {formatCurrency(customer.revenue)}
                </span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-2xs font-semibold bg-status-info/10 text-status-info">
                  {(customer.recoveryProbability * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
