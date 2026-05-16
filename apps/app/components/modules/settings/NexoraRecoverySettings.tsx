'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Save, CheckCircle2 } from 'lucide-react';
import { useNexoraSettings } from '@/lib/hooks/settings/useNexoraSettings';
import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import type { NexoraRecoverySettingsInput } from '@/lib/hooks/settings/useNexoraSettings';

export function NexoraRecoverySettings() {
  const { data: org } = useOrgQuery();
  const { mutate, isPending, error } = useNexoraSettings();
  const [saved, setSaved] = useState(false);

  // Extract Nexora settings from org (if they exist)
  const nexoraSettings = (org?.settings?.nexoraRecovery as any) || {};

  const customerNameVar = '{{customer_name}}';
  const businessNameVar = '{{business_name}}';

  const [inactivityDays, setInactivityDays] = useState(nexoraSettings.inactivityDays || 30);
  const [whatsappTemplate, setWhatsappTemplate] = useState(nexoraSettings.whatsappTemplate || '');
  const [emailTemplate, setEmailTemplate] = useState(nexoraSettings.emailTemplate || '');
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    nexoraSettings.whatsappEnabled !== false,
  );
  const [emailEnabled, setEmailEnabled] = useState(nexoraSettings.emailEnabled !== false);

  // Reset saved indicator after 2 seconds
  useEffect(() => {
    if (saved) {
      const timeout = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [saved]);

  function handleSave() {
    const input: NexoraRecoverySettingsInput = {
      inactivityDays,
      whatsappTemplate: whatsappTemplate || undefined,
      emailTemplate: emailTemplate || undefined,
      whatsappEnabled,
      emailEnabled,
    };
    mutate(input, {
      onSuccess: () => setSaved(true),
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Configurações de Recuperação</h2>
        <p className="text-sm text-text-muted mt-1">
          Ajuste como a Nexora detecta e recupera clientes inativos.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-lg border border-status-error-border bg-status-error-muted p-4 flex gap-3">
          <AlertCircle size={16} className="text-status-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-status-error">Erro ao salvar</p>
            <p className="text-xs text-status-error-secondary mt-1">
              {error instanceof Error ? error.message : 'Tente novamente'}
            </p>
          </div>
        </div>
      )}

      {/* Success alert */}
      {saved && (
        <div className="rounded-lg border border-status-success-border bg-status-success-muted p-4 flex gap-3">
          <CheckCircle2 size={16} className="text-status-success shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-status-success">Configurações salvas com sucesso</p>
        </div>
      )}

      {/* Inactivity threshold */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-text-primary mb-1">
            Dias até considerar cliente inativo
          </label>
          <p className="text-xs text-text-muted">
            Clientes sem atividade há este número de dias serão marcados como inativos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="180"
            value={inactivityDays}
            onChange={(e) => setInactivityDays(Math.min(180, Math.max(1, parseInt(e.target.value) || 1)))}
            className="px-3 py-2 border border-brand-border rounded-lg bg-brand-surface-2 text-text-primary text-sm w-24"
            disabled={isPending}
          />
          <span className="text-sm text-text-muted">dias</span>
        </div>
      </div>

      {/* Channel settings */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Canais de Recuperação</h3>
          <p className="text-xs text-text-muted">
            Escolha quais canais usar para enviar mensagens de recuperação.
          </p>
        </div>

        <div className="space-y-3">
          {/* WhatsApp toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-brand-surface-2">
            <div>
              <p className="text-sm font-medium text-text-primary">WhatsApp (Z-API)</p>
              <p className="text-xs text-text-muted">Envia mensagens via WhatsApp Business</p>
            </div>
            <label className="relative inline-block w-10 h-6">
              <input
                type="checkbox"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
                disabled={isPending}
                className="sr-only"
              />
              <div
                className={`w-full h-full rounded-full transition-colors ${
                  whatsappEnabled ? 'bg-brand-gold' : 'bg-brand-border'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    whatsappEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Email toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-brand-surface-2">
            <div>
              <p className="text-sm font-medium text-text-primary">Email (Resend)</p>
              <p className="text-xs text-text-muted">Envia mensagens via Email</p>
            </div>
            <label className="relative inline-block w-10 h-6">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                disabled={isPending}
                className="sr-only"
              />
              <div
                className={`w-full h-full rounded-full transition-colors ${
                  emailEnabled ? 'bg-brand-gold' : 'bg-brand-border'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    emailEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Message templates */}
      <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Templates de Mensagem</h3>
          <p className="text-xs text-text-muted">
            Personalize as mensagens enviadas aos clientes inativos. Use {customerNameVar}, {businessNameVar} como variáveis.
          </p>
        </div>

        <div className="space-y-4">
          {/* WhatsApp template */}
          {whatsappEnabled && (
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Template WhatsApp
              </label>
              <textarea
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                disabled={isPending}
                placeholder="Olá {{customer_name}}, saudades suas! 👋"
                maxLength={500}
                className="w-full px-3 py-2 border border-brand-border rounded-lg bg-brand-surface-2 text-text-primary text-sm resize-none h-24"
              />
              <p className="text-xs text-text-muted mt-1">{whatsappTemplate.length} / 500 caracteres</p>
            </div>
          )}

          {/* Email template */}
          {emailEnabled && (
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Template Email
              </label>
              <textarea
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                disabled={isPending}
                placeholder="Oi {{customer_name}}, que tal voltar? Temos uma oferta especial para você!"
                maxLength={500}
                className="w-full px-3 py-2 border border-brand-border rounded-lg bg-brand-surface-2 text-text-primary text-sm resize-none h-24"
              />
              <p className="text-xs text-text-muted mt-1">{emailTemplate.length} / 500 caracteres</p>
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isPending || saved}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-brand-gold/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {isPending ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
