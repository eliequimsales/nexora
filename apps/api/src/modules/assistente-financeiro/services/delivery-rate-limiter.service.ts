import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../common/redis/redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec?: number;
}

@Injectable()
export class DeliveryRateLimiterService {
  constructor(private readonly redis: RedisService) {}

  async checkLimit(
    orgId: string,
    channel: 'whatsapp' | 'email',
    max: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const client = this.redis.getClient();
    const key = `af:delivery-limit:${orgId}:${channel}`;

    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSec);
    }

    if (count > max) {
      const ttl = await client.ttl(key);
      return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }

    return { allowed: true, remaining: Math.max(0, max - count) };
  }
}

