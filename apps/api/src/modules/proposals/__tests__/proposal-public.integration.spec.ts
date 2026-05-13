import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { ProposalsController } from '../proposals.controller';
import { PublicProposalController } from '../public-proposal.controller';
import { ProposalsService } from '../proposals.service';
import { PrismaService } from '../../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PlanLimitsGuard } from '../../../common/guards/plan-limits.guard';

/**
 * I4 - Proposal Public Access Integration Tests
 *
 * Validates the public proposal flow (no-auth):
 *   - Service-level proposal creation
 *   - send() generates a unique token + status=sent
 *   - GET /proposals/p/:token returns proposal without auth
 *   - POST /proposals/p/:token/accept transitions to accepted + emits event
 *   - Invalid token → 404
 *   - Expired token (past validUntil) → marked expired, response is 400
 *
 * Strategy:
 *   - Real ProposalsService + both controllers, EventEmitter2 (no listeners).
 *   - Prisma fully mocked. Token format uses standard UUID v4.
 *   - Public routes are reached via supertest with no Authorization header.
 */
describe('Proposal Public Access Integration (e2e)', () => {
  let app: INestApplication;
  let service: ProposalsService;
  let eventEmitter: EventEmitter2;
  let prismaMock: any;

  const tenantContext = {
    userId: 'user-prop-1',
    orgId: 'org-prop-1',
    role: 'admin' as const,
    tokenId: 'tok-prop-1',
  };

  beforeAll(async () => {
    prismaMock = {
      proposal: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      proposalItem: { deleteMany: jest.fn(), create: jest.fn() },
      proposalView: { create: jest.fn() },
      lead: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    const allowAllGuard = { canActivate: jest.fn(() => true) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [ProposalsController, PublicProposalController],
      providers: [
        ProposalsService,
        EventEmitter2,
        { provide: PrismaService, useValue: prismaMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard)
      .overrideGuard(PlanLimitsGuard)
      .useValue(allowAllGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use((req: any, _res: any, next: any) => {
      req.user = tenantContext;
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    service = moduleFixture.get(ProposalsService);
    eventEmitter = moduleFixture.get(EventEmitter2);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Tests ────────────────────────────────────────────────────────────────

  it('should create proposal via service', async () => {
    prismaMock.lead.findUnique.mockResolvedValueOnce({
      id: 'lead-prop-1',
      orgId: tenantContext.orgId,
      name: 'Lead Proposta',
    });
    prismaMock.proposal.create.mockResolvedValueOnce({
      id: 'prop-int-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-prop-1',
      createdBy: tenantContext.userId,
      title: 'Proposta de integração',
      status: 'draft',
      token: null,
      note: null,
      validUntil: null,
      totalAmount: 250,
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lead: { name: 'Lead Proposta' },
      items: [
        { id: 'it-1', description: 'Item A', quantity: 1, unitPrice: 250, total: 250, position: 0 },
      ],
      _count: { views: 0 },
    });

    const result = await service.create(
      {
        leadId: 'lead-prop-1',
        title: 'Proposta de integração',
        items: [{ description: 'Item A', quantity: 1, unitPrice: 250 }],
      },
      tenantContext,
    );

    expect(result.id).toBe('prop-int-1');
    expect(result.status).toBe('draft');
    expect(result.totalAmount).toBe(250);
    expect(prismaMock.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: tenantContext.orgId,
          leadId: 'lead-prop-1',
          createdBy: tenantContext.userId,
          totalAmount: 250,
        }),
      }),
    );
  });

  it('should generate a unique public token on proposal send', async () => {
    const proposalDraft = {
      id: 'prop-send-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-prop-1',
      status: 'draft',
      lead: { email: 'lead@example.com', phone: null, name: 'Lead' },
    };
    let writtenToken: string | null = null;
    prismaMock.proposal.findUnique.mockResolvedValueOnce(proposalDraft);
    prismaMock.proposal.update.mockImplementation((args: any) => {
      writtenToken = args.data.token;
      return Promise.resolve({
        ...proposalDraft,
        ...args.data,
        items: [],
        _count: { views: 0 },
        sentAt: new Date(),
        viewedAt: null,
        respondedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lead: { name: 'Lead' },
      });
    });

    const result = await service.send('prop-send-1', tenantContext.orgId);

    expect(result.status).toBe('sent');
    expect(result.token).toBeTruthy();
    expect(writtenToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should return proposal via GET /proposals/p/:token without auth', async () => {
    const token = 'public-token-abc-123';
    prismaMock.proposal.findUnique.mockResolvedValue({
      id: 'prop-pub-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-1',
      title: 'Proposta Pública',
      status: 'sent',
      note: null,
      validUntil: null,
      totalAmount: 999,
      token,
      sentAt: new Date(),
      organization: { name: 'Org Test' },
      lead: { name: 'Lead Público' },
      items: [
        { id: 'i1', description: 'Serviço', quantity: 1, unitPrice: 999, total: 999, position: 0 },
      ],
    });
    prismaMock.$transaction.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get(`/proposals/p/${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'prop-pub-1',
      orgName: 'Org Test',
      title: 'Proposta Pública',
      status: 'sent',
      leadName: 'Lead Público',
    });
  });

  it('should accept proposal via POST /proposals/p/:token/accept', async () => {
    const token = 'accept-token-xyz-789';
    prismaMock.proposal.findUnique.mockResolvedValueOnce({
      id: 'prop-accept-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-accept-1',
      status: 'sent',
      validUntil: null,
      token,
      lead: { id: 'lead-accept-1', orgId: tenantContext.orgId },
    });
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const response = await request(app.getHttpServer())
      .post(`/proposals/p/${token}/accept`);

    expect(response.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    const txArgs = prismaMock.$transaction.mock.calls[0][0];
    // The first transaction op is the proposal.update with status=accepted
    expect(Array.isArray(txArgs)).toBe(true);
    expect(txArgs.length).toBeGreaterThanOrEqual(1);
  });

  it('should set status=accepted after public acceptance', async () => {
    const token = 'status-token-001';
    prismaMock.proposal.findUnique.mockResolvedValueOnce({
      id: 'prop-status-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-1',
      status: 'sent',
      validUntil: null,
      token,
      lead: { id: 'lead-1', orgId: tenantContext.orgId },
    });
    // Capture the update args passed to prisma.proposal.update inside the transaction.
    let capturedUpdate: any = null;
    const capturingProposalUpdate = jest.fn((args: any) => {
      capturedUpdate = args;
      return Promise.resolve(args);
    });
    const txLead = jest.fn().mockResolvedValue({});
    const localPrisma = {
      ...prismaMock,
      proposal: { ...prismaMock.proposal, update: capturingProposalUpdate },
      lead: { ...prismaMock.lead, update: txLead },
    };
    prismaMock.$transaction.mockImplementationOnce(async (ops: any[]) => {
      // Each op is a thenable (already a Prisma client promise); simulate awaiting.
      return Promise.all(ops);
    });

    // Replace the service's prisma binding temporarily so update calls hit our capture.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedPrisma = (service as any).prisma;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).prisma = localPrisma;

    try {
      await service.respond(token, 'accept');
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).prisma = savedPrisma;
    }

    expect(capturingProposalUpdate).toHaveBeenCalled();
    expect(capturedUpdate).toMatchObject({
      where: { id: 'prop-status-1' },
      data: expect.objectContaining({ status: 'accepted' }),
    });
  });

  it('should emit proposal.accepted event after acceptance', async () => {
    const token = 'emit-token-002';
    prismaMock.proposal.findUnique.mockResolvedValueOnce({
      id: 'prop-emit-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-emit-1',
      status: 'sent',
      validUntil: null,
      token,
      lead: { id: 'lead-emit-1', orgId: tenantContext.orgId },
    });
    prismaMock.$transaction.mockResolvedValueOnce([{}, {}]);

    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    await service.respond(token, 'accept');

    expect(emitSpy).toHaveBeenCalledWith(
      'proposal.accepted',
      expect.objectContaining({
        orgId: tenantContext.orgId,
        proposalId: 'prop-emit-1',
        leadId: 'lead-emit-1',
      }),
    );

    emitSpy.mockRestore();
  });

  it('should return 404 for invalid token', async () => {
    prismaMock.proposal.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get('/proposals/p/totally-unknown-token');

    expect(response.status).toBe(404);

    await expect(service.findByToken('totally-unknown-token')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should mark proposal as expired when validUntil is in the past', async () => {
    const token = 'expired-token-003';
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    prismaMock.proposal.findUnique.mockResolvedValueOnce({
      id: 'prop-expired-1',
      orgId: tenantContext.orgId,
      leadId: 'lead-exp-1',
      status: 'sent',
      validUntil: pastDate,
      token,
      lead: { id: 'lead-exp-1', orgId: tenantContext.orgId },
    });
    prismaMock.proposal.update.mockResolvedValueOnce({});

    await expect(service.respond(token, 'accept')).rejects.toThrow(/expirou/i);

    // It should also persist the expired status on the proposal
    expect(prismaMock.proposal.update).toHaveBeenCalledWith({
      where: { id: 'prop-expired-1' },
      data: { status: 'expired' },
    });
  });
});
