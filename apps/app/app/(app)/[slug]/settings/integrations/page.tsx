'use client';

import { Plug, AlertTriangle } from 'lucide-react';
import { ChannelCard } from '@/components/modules/integrations/ChannelCard';
import { WebhookList } from '@/components/modules/integrations/WebhookList';
import { IntegrationLogsTable } from '@/components/modules/integrations/IntegrationLogsTable';
import { useConfigs } from '@/lib/hooks/integrations/useConfigs';
import { CanDo } from '@/components/shared/CanDo/CanDo';

export default function IntegrationsPage() {
  const { data: configs = [] } = useConfigs();

  const emailConfig = configs.find((c) => c.channel === 'email');
  const whatsappConfig = configs.find((c) => c.channel === 'whatsapp');

  return (
    <CanDo
      permission="integrations:read"
      fallback={
        <div className="p-6">
          <p className="text-sm text-status-error">Acesso restrito a administradores.</p>
        </div>
      }
    >
      <div className="p-6 max-w-3xl space-y-8">
        <div className="flex items-center gap-2.5">
          <Plug size={18} className="text-text-secondary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Integrações</h1>
            <p className="text-xs text-text-muted">Conecte canais de comunicação e sistemas externos</p>
          </div>
        </div>

        {/* Channels */}
        <section>
          <p className="text-sm font-semibold text-text-primary mb-3">Canais de comunicação</p>
          <div className="space-y-3">
            <ChannelCard channel="email" existing={emailConfig} />

            {/* WhatsApp automático — apenas usuários avançados */}
            <div>
              <ChannelCard channel="whatsapp" existing={whatsappConfig} />
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 px-3 py-2.5">
                <AlertTriangle size={13} className="text-status-warning shrink-0 mt-0.5" />
                <p className="text-xs text-text-muted leading-relaxed">
                  <strong className="text-text-secondary">Avançado:</strong> Envio automático via Evolution API exige servidor próprio e pode violar os termos do WhatsApp. Durante o piloto, recomendamos usar o modo manual — a IA gera a mensagem e você envia do seu número normalmente.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Outbound Webhooks */}
        <section>
          <WebhookList />
        </section>

        {/* Logs */}
        <section>
          <IntegrationLogsTable />
        </section>
      </div>
    </CanDo>
  );
}
