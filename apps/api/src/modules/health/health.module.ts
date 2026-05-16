import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health checks module.
 *
 * Relies on globally provided `PrismaService` and `RedisService`.
 * Endpoints are public (no auth needed) and used by platform health probes
 * + external uptime monitors.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
