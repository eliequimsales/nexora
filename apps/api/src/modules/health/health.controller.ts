import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

/**
 * Operational endpoints used by uptime monitors and platform health probes.
 *
 * - `/healthz` is a cheap liveness probe (always 200 when the process is up).
 *   Use this for k8s liveness, UptimeRobot, etc.
 *
 * - `/readiness` is a deeper readiness probe — it verifies that Postgres and
 *   Redis are reachable. Use this for k8s readiness or to gate traffic during
 *   rolling deploys. Returns 503 when any dependency is down.
 *
 * Both endpoints are marked `@Public()` so they bypass the global JwtAuthGuard.
 */
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('healthz')
  liveness(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('readiness')
  async readiness(): Promise<{
    status: 'ready';
    checks: { postgres: 'up'; redis: 'up' };
  }> {
    const errors: string[] = [];

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      errors.push(`postgres: ${err?.message ?? 'unknown error'}`);
    }

    try {
      await this.redis.ping();
    } catch (err: any) {
      errors.push(`redis: ${err?.message ?? 'unknown error'}`);
    }

    if (errors.length > 0) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        errors,
      });
    }

    return {
      status: 'ready',
      checks: { postgres: 'up', redis: 'up' },
    };
  }
}
