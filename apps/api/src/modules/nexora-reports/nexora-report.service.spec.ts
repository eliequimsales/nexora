import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NexoraReportService } from './nexora-report.service';
import { PrismaService } from '../../database/prisma.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const ADMIN = { email: 'admin@barbearia.com', name: 'João Barbeiro' };

describe('NexoraReportService', () => {
  let service: NexoraReportService;
  let prismaMock: any;
  let configMock: any;

  beforeEach(async () => {
    jest.resetAllMocks();

    prismaMock = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findFirst: jest.fn() },
      lead: { count: jest.fn(), aggregate: jest.fn() },
      activityLog: { count: jest.fn() },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'resend.apiKey') return 'test-resend-key';
        if (key === 'resend.fromEmail') return 'reports@nexora.com.br';
        if (key === 'resend.fromName') return 'Nexora';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NexoraReportService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<NexoraReportService>(NexoraReportService);
  });

  describe('computeWeeklyStats', () => {
    it('aggregates inactive count, recoveries sent, responses, confirmed, and revenue', async () => {
      prismaMock.lead.count
        .mockResolvedValueOnce(42) // inactiveDetected
        .mockResolvedValueOnce(5); // confirmedRecoveries
      prismaMock.activityLog.count
        .mockResolvedValueOnce(20) // recoveriesSent
        .mockResolvedValueOnce(8); // responsesReceived
      prismaMock.lead.aggregate.mockResolvedValueOnce({
        _sum: { recoveredValue: 400 },
      });

      const result = await service.computeWeeklyStats('org-1');

      expect(result.inactiveDetected).toBe(42);
      expect(result.recoveriesSent).toBe(20);
      expect(result.responsesReceived).toBe(8);
      expect(result.confirmedRecoveries).toBe(5);
      expect(result.realRevenue).toBe(400);
      expect(result.potentialRevenue).toBe(42 * 80); // 30 * 80 ticket = 3360
    });

    it('handles null revenue aggregate (no confirmed recoveries)', async () => {
      prismaMock.lead.count.mockResolvedValue(0);
      prismaMock.activityLog.count.mockResolvedValue(0);
      prismaMock.lead.aggregate.mockResolvedValueOnce({
        _sum: { recoveredValue: null },
      });

      const result = await service.computeWeeklyStats('org-1');

      expect(result.realRevenue).toBe(0);
    });
  });

  describe('sendWeeklyReport', () => {
    function setupActiveOrg(stats: {
      inactives?: number;
      sent?: number;
      responses?: number;
      confirmed?: number;
      revenue?: number;
    } = {}) {
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        name: 'Barbearia Teste',
        slug: 'barbearia-teste',
        niche: 'barbearia',
      });
      prismaMock.user.findFirst.mockResolvedValueOnce(ADMIN);
      prismaMock.lead.count
        .mockResolvedValueOnce(stats.inactives ?? 10)
        .mockResolvedValueOnce(stats.confirmed ?? 2);
      prismaMock.activityLog.count
        .mockResolvedValueOnce(stats.sent ?? 5)
        .mockResolvedValueOnce(stats.responses ?? 3);
      prismaMock.lead.aggregate.mockResolvedValueOnce({
        _sum: { recoveredValue: stats.revenue ?? 160 },
      });
    }

    it('sends email via Resend HTTP with correct shape', async () => {
      setupActiveOrg();
      mockedAxios.post.mockResolvedValueOnce({ data: { id: 'resend-id-1' } });

      const ok = await service.sendWeeklyReport('org-1');

      expect(ok).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          to: ['admin@barbearia.com'],
          subject: expect.stringContaining('R$'),
          text: expect.stringContaining('Barbearia Teste'),
          html: expect.stringContaining('Barbearia Teste'),
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-resend-key' },
        }),
      );
    });

    it('skips when org has zero activity (no inactives, no sent, no recovered)', async () => {
      setupActiveOrg({ inactives: 0, sent: 0, responses: 0, confirmed: 0, revenue: 0 });

      const ok = await service.sendWeeklyReport('org-1');

      expect(ok).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('skips when org has no admin email', async () => {
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        name: 'Solo Barbearia',
        slug: 'solo',
        niche: 'barbearia',
      });
      prismaMock.user.findFirst.mockResolvedValueOnce(null);

      const ok = await service.sendWeeklyReport('org-1');

      expect(ok).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('skips non-barbershop orgs (other niche)', async () => {
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        name: 'Generic SaaS',
        slug: 'generic',
        niche: 'consultoria',
      });

      const ok = await service.sendWeeklyReport('org-1');

      expect(ok).toBe(false);
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });

    it('returns false (without throwing) when Resend fails', async () => {
      setupActiveOrg();
      mockedAxios.post.mockRejectedValueOnce(new Error('429 too many requests'));

      const ok = await service.sendWeeklyReport('org-1');

      expect(ok).toBe(false);
    });

    it('subject celebrates when there is real revenue', async () => {
      setupActiveOrg({ confirmed: 4, revenue: 320 });
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      await service.sendWeeklyReport('org-1');

      const payload = mockedAxios.post.mock.calls[0][1] as any;
      expect(payload.subject).toMatch(/recuperou/i);
    });

    it('subject is a wake-up call when no revenue yet', async () => {
      setupActiveOrg({ confirmed: 0, revenue: 0, inactives: 15 });
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      await service.sendWeeklyReport('org-1');

      const payload = mockedAxios.post.mock.calls[0][1] as any;
      expect(payload.subject).toMatch(/esperando/i);
    });
  });

  describe('with Resend not configured', () => {
    beforeEach(async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'resend.apiKey') return ''; // not configured
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NexoraReportService,
          { provide: PrismaService, useValue: prismaMock },
          { provide: ConfigService, useValue: configMock },
        ],
      }).compile();

      service = module.get<NexoraReportService>(NexoraReportService);
    });

    it('returns false without hitting Prisma when apiKey missing', async () => {
      const ok = await service.sendWeeklyReport('org-1');
      expect(ok).toBe(false);
      expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('sendAllWeeklyReports', () => {
    it('iterates all active barbershop orgs and counts sent/skipped', async () => {
      prismaMock.organization.findMany.mockResolvedValueOnce([
        { id: 'org-1' },
        { id: 'org-2' },
      ]);

      // org-1 → sends successfully
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: 'org-1',
        name: 'A',
        slug: 'a',
        niche: 'barbearia',
      });
      prismaMock.user.findFirst.mockResolvedValueOnce(ADMIN);
      prismaMock.lead.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
      prismaMock.activityLog.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      prismaMock.lead.aggregate.mockResolvedValueOnce({ _sum: { recoveredValue: 80 } });
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // org-2 → no activity, skipped
      prismaMock.organization.findUnique.mockResolvedValueOnce({
        id: 'org-2',
        name: 'B',
        slug: 'b',
        niche: 'barbearia',
      });
      prismaMock.user.findFirst.mockResolvedValueOnce(ADMIN);
      prismaMock.lead.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prismaMock.activityLog.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prismaMock.lead.aggregate.mockResolvedValueOnce({ _sum: { recoveredValue: null } });

      const result = await service.sendAllWeeklyReports();

      expect(result.sent).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });
});
