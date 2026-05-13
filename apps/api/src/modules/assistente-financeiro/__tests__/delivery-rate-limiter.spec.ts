import { Test } from '@nestjs/testing';
import { DeliveryRateLimiterService } from '../services/delivery-rate-limiter.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('DeliveryRateLimiterService', () => {
  let limiter: DeliveryRateLimiterService;
  let mockRedis: { incr: jest.Mock; expire: jest.Mock; ttl: jest.Mock };

  beforeEach(async () => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        DeliveryRateLimiterService,
        { provide: RedisService, useValue: { getClient: () => mockRedis } },
      ],
    }).compile();
    limiter = module.get(DeliveryRateLimiterService);
  });

  it('allows first request and sets expiry', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const result = await limiter.checkLimit('org-123', 'whatsapp', 60, 3600);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
    expect(mockRedis.expire).toHaveBeenCalledWith(expect.any(String), 3600);
  });

  it('does not reset expiry on subsequent requests', async () => {
    mockRedis.incr.mockResolvedValue(5);

    const result = await limiter.checkLimit('org-123', 'whatsapp', 60, 3600);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(55);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('blocks when limit exceeded', async () => {
    mockRedis.incr.mockResolvedValue(61);
    mockRedis.ttl.mockResolvedValue(120);

    const result = await limiter.checkLimit('org-123', 'whatsapp', 60, 3600);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBe(120);
  });
});
