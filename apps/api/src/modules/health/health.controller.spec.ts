import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaMock: { $queryRaw: jest.Mock };
  let redisMock: { ping: jest.Mock };

  beforeEach(async () => {
    prismaMock = { $queryRaw: jest.fn() };
    redisMock = { ping: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /healthz (liveness)', () => {
    it('returns status ok with process uptime', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('does not touch dependencies', () => {
      controller.liveness();

      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      expect(redisMock.ping).not.toHaveBeenCalled();
    });
  });

  describe('GET /readiness', () => {
    it('returns ready when postgres and redis respond', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      redisMock.ping.mockResolvedValueOnce('PONG');

      const result = await controller.readiness();

      expect(result.status).toBe('ready');
      expect(result.checks).toEqual({ postgres: 'up', redis: 'up' });
    });

    it('throws 503 when postgres is down', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      redisMock.ping.mockResolvedValueOnce('PONG');

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws 503 when redis is down', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      redisMock.ping.mockRejectedValueOnce(new Error('redis timeout'));

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });

    it('reports both failures when both are down', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('pg down'));
      redisMock.ping.mockRejectedValueOnce(new Error('redis down'));

      try {
        await controller.readiness();
        fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const body = err.getResponse();
        expect(body.errors).toHaveLength(2);
        expect(body.errors[0]).toContain('postgres');
        expect(body.errors[1]).toContain('redis');
      }
    });
  });
});
