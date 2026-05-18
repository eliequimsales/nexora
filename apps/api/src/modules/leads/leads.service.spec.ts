import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { TenantContext } from '../../common/tenant/tenant-context';

const CTX: TenantContext = { orgId: 'org-1', userId: 'user-1', role: 'admin', tokenId: 'tok-1' };

const MOCK_LEAD = {
  id: 'lead-1',
  orgId: 'org-1',
  name: 'Test Lead',
  email: 'lead@example.com',
  phone: null,
  source: 'manual',
  status: 'new',
  pipelineStageId: null,
  archivedAt: null,
  aiClassification: null,
  aiScore: null,
  assignedTo: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  lead: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  pipelineStage: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  activityLog: { create: jest.fn() },
  // findInactive lê settings.nexoraRecovery.avgTicket — default OK
  organization: {
    findUnique: jest.fn().mockResolvedValue({ settings: {} }),
  },
};

const mockEventEmitter = { emit: jest.fn() };

describe('LeadsService — update guards (C1 regression)', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    // findInactive le settings.nexoraRecovery.avgTicket; sem isso → undefined.
    // Resetamos pra { settings: {} } em todos os testes pra cair no default 80.
    mockPrisma.organization.findUnique.mockResolvedValue({ settings: {} });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  describe('update', () => {
    it('throws NotFoundException when lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce(null);

      await expect(service.update('non-existent', { name: 'X' }, CTX))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when pipelineStageId belongs to another tenant', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce({ ...MOCK_LEAD });
      // stage found but belongs to different org
      mockPrisma.pipelineStage.findUnique.mockResolvedValueOnce({ orgId: 'org-EVIL' });

      await expect(
        service.update('lead-1', { pipelineStageId: 'stage-evil' }, CTX),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when pipelineStageId does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce({ ...MOCK_LEAD });
      mockPrisma.pipelineStage.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('lead-1', { pipelineStageId: 'stage-ghost' }, CTX),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when assignedTo belongs to another tenant', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce({ ...MOCK_LEAD });
      // user found but belongs to different org
      mockPrisma.user.findUnique.mockResolvedValueOnce({ orgId: 'org-EVIL' });

      await expect(
        service.update('lead-1', { assignedTo: 'user-evil' }, CTX),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when assignedTo user does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValueOnce({ ...MOCK_LEAD });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('lead-1', { assignedTo: 'user-ghost' }, CTX),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates lead successfully when valid stageId and assignedTo provided', async () => {
      const updated = { ...MOCK_LEAD, pipelineStageId: 'stage-1', assignedTo: 'user-2' };
      mockPrisma.lead.findUnique.mockResolvedValueOnce({ ...MOCK_LEAD });
      mockPrisma.pipelineStage.findUnique.mockResolvedValueOnce({ orgId: 'org-1' });
      mockPrisma.user.findUnique.mockResolvedValueOnce({ orgId: 'org-1' });
      mockPrisma.lead.update.mockResolvedValueOnce(updated);

      const result = await service.update(
        'lead-1',
        { pipelineStageId: 'stage-1', assignedTo: 'user-2' },
        CTX,
      );

      expect(result.id).toBe('lead-1');
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('findInactive', () => {
    const buildInactiveLead = (overrides: Partial<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      updatedAt: Date;
      status: string;
      aiClassification: string | null;
    }> = {}) => ({
      id: 'lead-X',
      name: 'Customer X',
      email: 'x@example.com',
      phone: null,
      updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      status: 'contacted',
      aiClassification: null,
      ...overrides,
    });

    it('returns clients inactive for more than 30 days with derived fields', async () => {
      const lead = buildInactiveLead({
        id: 'lead-old',
        name: 'João Old',
        updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      });
      mockPrisma.lead.findMany.mockResolvedValueOnce([lead]);

      const result = await service.findInactive(CTX, 30);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lead-old');
      expect(result[0].name).toBe('João Old');
      expect(result[0].daysSinceLastActivity).toBeGreaterThanOrEqual(44);
      expect(result[0].daysSinceLastActivity).toBeLessThanOrEqual(46);
      expect(result[0].estimatedValue).toBe(80);
    });

    it('queries with default 30-day cutoff when no parameter is passed', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      const before = Date.now();
      await service.findInactive(CTX);
      const after = Date.now();

      expect(mockPrisma.lead.findMany).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.lead.findMany.mock.calls[0][0];
      const cutoff: Date = callArgs.where.updatedAt.lt;
      const expectedMin = before - 30 * 24 * 60 * 60 * 1000 - 1000;
      const expectedMax = after - 30 * 24 * 60 * 60 * 1000 + 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('accepts a custom day threshold', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      const before = Date.now();
      await service.findInactive(CTX, 60);
      const after = Date.now();

      const callArgs = mockPrisma.lead.findMany.mock.calls[0][0];
      const cutoff: Date = callArgs.where.updatedAt.lt;
      const expectedMin = before - 60 * 24 * 60 * 60 * 1000 - 1000;
      const expectedMax = after - 60 * 24 * 60 * 60 * 1000 + 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('excludes leads with closed_won and closed_lost status', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      await service.findInactive(CTX, 30);

      const callArgs = mockPrisma.lead.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toEqual({ notIn: ['closed_lost', 'closed_won'] });
    });

    it('excludes archived leads', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      await service.findInactive(CTX, 30);

      const callArgs = mockPrisma.lead.findMany.mock.calls[0][0];
      expect(callArgs.where.archivedAt).toBeNull();
    });

    it('scopes the query to the current orgId (multi-tenant isolation)', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      await service.findInactive(CTX, 30);

      const callArgs = mockPrisma.lead.findMany.mock.calls[0][0];
      expect(callArgs.where.orgId).toBe('org-1');
    });

    it('orders results oldest-first (most abandoned customers come first)', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      await service.findInactive(CTX, 30);

      const callArgs = mockPrisma.lead.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ updatedAt: 'asc' });
    });

    it('returns an empty list when no leads are inactive', async () => {
      mockPrisma.lead.findMany.mockResolvedValueOnce([]);

      const result = await service.findInactive(CTX, 30);

      expect(result).toEqual([]);
    });
  });
});
