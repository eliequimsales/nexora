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
  lead: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  pipelineStage: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  activityLog: { create: jest.fn() },
};

const mockEventEmitter = { emit: jest.fn() };

describe('LeadsService — update guards (C1 regression)', () => {
  let service: LeadsService;

  beforeEach(async () => {
    jest.resetAllMocks();

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
});
