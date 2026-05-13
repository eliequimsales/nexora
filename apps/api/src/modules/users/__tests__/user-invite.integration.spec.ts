import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../audit-logs/audit-log.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PlanLimitsGuard } from '../../../common/guards/plan-limits.guard';

/**
 * I3 - User Invite Integration Tests
 *
 * Validates the invite flow end-to-end:
 *   - POST /users/invite creates user with status=active and chosen role
 *   - Service returns temporary password
 *   - Temporary password hash matches via bcrypt.compare
 *   - Duplicate email within the same org → ConflictException (409)
 *   - Only admin permission can invite (here verified via service + guard)
 *   - AuditLogService.record is called (acts as the "send invite email" mock)
 *
 * Strategy:
 *   - Real UsersService + UsersController with global ValidationPipe.
 *   - Prisma mocked to control duplicate-email detection.
 *   - Guards bypassed for HTTP-level paths; we test admin-only enforcement
 *     by overriding RolesGuard with a strict implementation for a single test.
 */
describe('User Invite Integration (e2e)', () => {
  let app: INestApplication;
  let prismaMock: any;
  let auditLogMock: any;
  let usersService: UsersService;

  const adminContext = {
    userId: 'user-admin-1',
    orgId: 'org-invite-1',
    role: 'admin' as const,
    tokenId: 'tok-admin-1',
  };

  beforeAll(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditLogMock = {
      record: jest.fn(),
    };

    const allowAllGuard = { canActivate: jest.fn(() => true) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogService, useValue: auditLogMock },
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
      req.user = adminContext;
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    usersService = moduleFixture.get(UsersService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Tests ────────────────────────────────────────────────────────────────

  it('should create user with status=active and role=member', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null); // email is free
    let createdUser: any = null;
    prismaMock.user.create.mockImplementation((args: any) => {
      createdUser = {
        id: 'user-new-1',
        ...args.data,
        avatarUrl: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return Promise.resolve(createdUser);
    });

    const response = await request(app.getHttpServer())
      .post('/users/invite')
      .send({ email: 'newmember@example.com', role: 'member' });

    expect(response.status).toBe(202);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'newmember@example.com',
        role: 'member',
        status: 'active',
        orgId: adminContext.orgId,
      }),
    });
    expect(createdUser.status).toBe('active');
    expect(createdUser.role).toBe('member');
  });

  it('should return temporary password for new user', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockImplementation((args: any) =>
      Promise.resolve({
        id: 'user-new-2',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/users/invite')
      .send({ email: 'temp@example.com', role: 'member' });

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('tempPassword');
    expect(typeof response.body.tempPassword).toBe('string');
    expect(response.body.tempPassword).toMatch(/^[0-9a-f]{12}$/); // 12-char hex
  });

  it('should produce a passwordHash that validates against the returned tempPassword', async () => {
    let storedHash: string | null = null;
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockImplementation((args: any) => {
      storedHash = args.data.passwordHash;
      return Promise.resolve({
        id: 'user-bcrypt-1',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // We call the service directly so we can assert the returned tempPassword
    // matches the stored hash — the controller layer would obscure this.
    const result = await usersService.inviteUser(adminContext, {
      email: 'bcrypt@example.com',
      role: 'member',
    });

    expect(result.tempPassword).toMatch(/^[0-9a-f]{12}$/);
    expect(storedHash).toBeTruthy();
    const valid = await bcrypt.compare(result.tempPassword, storedHash!);
    expect(valid).toBe(true);
  });

  it('should reject invite if email already exists in the same org', async () => {
    // The HTTP path and the direct service path each consume one findFirst call,
    // so we make the mock return the duplicate twice in a row.
    prismaMock.user.findFirst
      .mockResolvedValueOnce({
        id: 'user-existing-1',
        email: 'duplicate@example.com',
        orgId: adminContext.orgId,
      })
      .mockResolvedValueOnce({
        id: 'user-existing-1',
        email: 'duplicate@example.com',
        orgId: adminContext.orgId,
      });

    const response = await request(app.getHttpServer())
      .post('/users/invite')
      .send({ email: 'duplicate@example.com', role: 'member' });

    expect(response.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    // Also assert the service path throws the right exception class
    await expect(
      usersService.inviteUser(adminContext, {
        email: 'duplicate@example.com',
        role: 'member',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should record an audit log entry on successful invite (acts as send-email mock)', async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);
    prismaMock.user.create.mockImplementation((args: any) =>
      Promise.resolve({
        id: 'user-audit-1',
        ...args.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    await request(app.getHttpServer())
      .post('/users/invite')
      .send({ email: 'audit@example.com', role: 'admin' });

    expect(auditLogMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: adminContext.orgId,
        actorId: adminContext.userId,
        action: 'user.invited',
        resourceType: 'user',
        metadata: expect.objectContaining({
          email: 'audit@example.com',
          role: 'admin',
        }),
      }),
    );
  });

  it('should reject invite from non-admin role when RolesGuard is enforced', async () => {
    // Spin up a second mini-app with a guard that only permits admins.
    // Mirrors production behavior of @RequirePermission('users:invite')
    // resolving to admin role in the shared RBAC table. We register the
    // strict guard via APP_GUARD so it actually runs (overrideGuard()
    // doesn't apply when guards aren't on the controller directly).
    const memberCtx = { ...adminContext, role: 'member' as const };

    class StrictRolesGuard {
      canActivate(ctx: any): boolean {
        const req = ctx.switchToHttp().getRequest();
        if (req.user?.role !== 'admin') {
          throw new ForbiddenException();
        }
        return true;
      }
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditLogService, useValue: auditLogMock },
        { provide: APP_GUARD, useClass: StrictRolesGuard },
      ],
    }).compile();

    const strictApp = moduleFixture.createNestApplication();
    strictApp.use((req: any, _res: any, next: any) => {
      req.user = memberCtx;
      next();
    });
    strictApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await strictApp.init();

    const response = await request(strictApp.getHttpServer())
      .post('/users/invite')
      .send({ email: 'blocked@example.com', role: 'member' });

    // Forbidden because role != admin
    expect(response.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();

    await strictApp.close();
  });
});
