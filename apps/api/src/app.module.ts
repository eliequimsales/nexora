import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PlanLimitsGuard } from './common/guards/plan-limits.guard';
import { PlanLimitsService } from './common/billing/plan-limits.service';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LeadsModule } from './modules/leads/leads.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { AiActionsModule } from './modules/ai-actions/ai-actions.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SecretaryModule } from './modules/secretary/secretary.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { BillingModule } from './modules/billing/billing.module';
import { QueueModule } from './workers/queue.module';
import { AssistenteFinanceiroModule } from './modules/assistente-financeiro/assistente-financeiro.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: true },
    }),

    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.get<string>('redis.url') ?? 'redis://localhost:6379');
        return {
          connection: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port) || 6379,
            password: redisUrl.password || undefined,
            db: parseInt(redisUrl.pathname?.slice(1)) || 0,
            maxRetriesPerRequest: null,
          },
        };
      },
      inject: [ConfigService],
    }),

    ScheduleModule.forRoot(),

    DatabaseModule,
    RedisModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    DashboardModule,
    LeadsModule,
    PipelineModule,
    WorkflowsModule,
    AiActionsModule,
    CopilotModule,
    ProposalsModule,
    AnalyticsModule,
    AuditLogsModule,
    IntegrationsModule,
    SecretaryModule,
    TasksModule,
    NotificationsModule,
    TemplatesModule,
    BillingModule,
    QueueModule,
    AssistenteFinanceiroModule,
    HealthModule,
  ],

  providers: [
    // Guards registered here are applied globally via DI — Reflector is properly injected.
    // JwtAuthGuard first: establishes identity. RolesGuard second: enforces role constraints.
    // Use @Public() to opt out of auth. Use @RequirePermission() or @Roles() to add constraints.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PlanLimitsGuard },
    PlanLimitsService,
  ],
})
export class AppModule {}
