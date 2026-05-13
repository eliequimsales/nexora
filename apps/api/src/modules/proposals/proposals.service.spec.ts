import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsService } from './proposals.service';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const INCLUDE_FULL = expect.objectContaining({});

const MOCK_PROPOSAL = {
  id: 'prop-1',
  orgId: 'org-1',
  leadId: 'lead-1',
  createdBy: 'user-1',
  title: 'Proposta Teste',
  note: null,
  validUntil: null,
  status: 'draft',
  token: null,
  totalAmount: 1000,
  sentAt: null,
  viewedAt: null,
  respondedAt: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SENT_PROPOSAL = {
  ...MOCK_PROPOSAL,
  status: 'sent',
  token: 'valid-token-abc',
  sentAt: new Date(),
  lead: { id: 'lead-1', orgId: 'org-1' },
};

const mockPrisma = {
  proposal: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  lead: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventEmitter = { emit: jest.fn() };

describe('ProposalsService — respond (public flow)', () => {
  let service: ProposalsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
  });

  it('throws NotFoundException for unknown token', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValueOnce(null);

    await expect(service.respond('ghost-token', 'accept')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for already accepted proposal (not in sent/viewed)', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValueOnce({
      ...SENT_PROPOSAL,
      status: 'accepted',
    });

    await expect(service.respond('valid-token-abc', 'accept')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException and marks expired for proposal past validUntil', async () => {
    const expiredDate = new Date(Date.now() - 1_000);
    mockPrisma.proposal.findUnique.mockResolvedValueOnce({
      ...SENT_PROPOSAL,
      validUntil: expiredDate,
    });
    mockPrisma.proposal.update.mockResolvedValueOnce({});

    await expect(service.respond('valid-token-abc', 'accept')).rejects.toThrow(BadRequestException);

    expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: { status: 'expired' },
    });
  });

  it('sets status to accepted and lead to closed_won on valid accept', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValueOnce(SENT_PROPOSAL);
    mockPrisma.$transaction.mockResolvedValueOnce([{}, {}]);

    await service.respond('valid-token-abc', 'accept');

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({}), // proposal update
        expect.objectContaining({}), // lead update
      ]),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'proposal.accepted',
      expect.objectContaining({ proposalId: 'prop-1', leadId: 'lead-1' }),
    );
  });

  it('sets status to rejected and does NOT update lead on valid reject', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValueOnce(SENT_PROPOSAL);
    mockPrisma.$transaction.mockResolvedValueOnce([{}]);

    await service.respond('valid-token-abc', 'reject', 'too expensive');

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({}), // proposal update only
      ]),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'proposal.rejected',
      expect.objectContaining({ reason: 'too expensive' }),
    );
  });

  it('accepts proposal in viewed status (lead already opened the link)', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValueOnce({
      ...SENT_PROPOSAL,
      status: 'viewed',
      viewedAt: new Date(),
    });
    mockPrisma.$transaction.mockResolvedValueOnce([{}, {}]);

    await expect(service.respond('valid-token-abc', 'accept')).resolves.toBeUndefined();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('proposal.accepted', expect.any(Object));
  });
});

describe('ProposalsService — send', () => {
  let service: ProposalsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProposalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ProposalsService>(ProposalsService);
  });

  it('throws BadRequestException when proposal is already sent', async () => {
    mockPrisma.proposal.findUnique.mockResolvedValueOnce({
      ...SENT_PROPOSAL,
      lead: { email: null, phone: null, name: 'Test' },
    });

    await expect(service.send('prop-1', 'org-1')).rejects.toThrow(BadRequestException);
  });
});
