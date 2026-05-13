import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationsController } from './integrations.controller';
import { IngestController } from './ingest.controller';
import { IntegrationsService } from './integrations.service';
import { ChannelService } from './channel.service';
import { IntegrationCryptoService } from './integration-crypto.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import { EmailAdapter } from './adapters/email.adapter';
import { WhatsAppAdapter } from './adapters/whatsapp.adapter';
import { QUEUE_NAMES } from '@reshit/shared';
import { PlanLimitsService } from '../../common/billing/plan-limits.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.WEBHOOKS })],
  controllers: [IntegrationsController, IngestController],
  providers: [
    IntegrationsService,
    ChannelService,
    IntegrationCryptoService,
    WebhookDispatcherService,
    EmailAdapter,
    WhatsAppAdapter,
    PlanLimitsService,
  ],
  exports: [ChannelService, IntegrationCryptoService, WebhookDispatcherService],
})
export class IntegrationsModule {}
