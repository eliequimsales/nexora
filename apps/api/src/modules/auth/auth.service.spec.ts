import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../database/prisma.service';

const MOCK_USER = {
  id: 'user-1',
  orgId: 'org-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '',
  role: 'admin',
  status: 'active',
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_ORG = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
  niche: 'real_estate',
  status: 'active',
  aiPrompts: {},
  formToken: 'abc123',
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  pipelineStage: {
    createMany: jest.fn(),
  },
  subscription: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockTokenService = {
  generateTokens: jest.fn(),
  validateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // Reset clears queued return values AND call history
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      orgName: 'Test Org',
      niche: 'real_estate',
    };

    it('creates org, pipeline stages, and admin user in a transaction', async () => {
      const hash = await bcrypt.hash('password123', 4);
      const user = { ...MOCK_USER, passwordHash: hash };
      const org = { ...MOCK_ORG };

      // Slug check runs BEFORE the transaction
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.organization.create.mockResolvedValueOnce(org);
          mockPrisma.pipelineStage.createMany.mockResolvedValueOnce({ count: 6 });
          mockPrisma.user.findUnique.mockResolvedValueOnce(null); // email check
          mockPrisma.user.create.mockResolvedValueOnce(user);
          return fn(mockPrisma);
        },
      );

      mockTokenService.generateTokens.mockResolvedValueOnce({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenId: 'token-id',
      });

      const result = await service.register(registerDto);

      expect(result.access_token).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.organization.niche).toBe('real_estate');
    });

    it('throws BadRequestException for unsupported niche', async () => {
      await expect(
        service.register({ ...registerDto, niche: 'unknown_niche' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on duplicate email within org', async () => {
      const existingUser = { ...MOCK_USER };
      const org = { ...MOCK_ORG };

      // Slug check before transaction
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.organization.create.mockResolvedValueOnce(org);
          mockPrisma.pipelineStage.createMany.mockResolvedValueOnce({ count: 6 });
          mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser); // email taken
          return fn(mockPrisma);
        },
      );

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const ACTIVE_ORG = { id: 'org-1', status: 'active' };

    it('returns tokens for valid credentials with correct slug', async () => {
      const hash = await bcrypt.hash('password123', 4);
      const user = { ...MOCK_USER, passwordHash: hash, organization: MOCK_ORG };

      mockPrisma.organization.findUnique.mockResolvedValueOnce(ACTIVE_ORG);
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.user.update.mockResolvedValueOnce(user);
      mockTokenService.generateTokens.mockResolvedValueOnce({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenId: 'token-id',
      });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
        slug: 'test-org',
      });

      expect(result.access_token).toBe('access-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-org' },
        select: { id: true, status: true },
      });
    });

    it('throws UnauthorizedException with generic message on wrong password', async () => {
      const hash = await bcrypt.hash('correct-password', 4);
      const user = { ...MOCK_USER, passwordHash: hash, organization: MOCK_ORG };

      mockPrisma.organization.findUnique.mockResolvedValueOnce(ACTIVE_ORG);
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password', slug: 'test-org' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('throws UnauthorizedException when slug does not match any org', async () => {
      // org not found → constant-time path falls through
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'any', slug: 'wrong-slug' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('throws UnauthorizedException with same generic message when email not found in org', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(ACTIVE_ORG);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any', slug: 'test-org' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('throws UnauthorizedException for inactive user', async () => {
      const hash = await bcrypt.hash('password123', 4);
      const user = {
        ...MOCK_USER,
        passwordHash: hash,
        status: 'inactive',
        organization: MOCK_ORG,
      };

      mockPrisma.organization.findUnique.mockResolvedValueOnce(ACTIVE_ORG);
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123', slug: 'test-org' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for suspended org (status !== active)', async () => {
      const hash = await bcrypt.hash('password123', 4);
      const user = { ...MOCK_USER, passwordHash: hash, organization: MOCK_ORG };

      mockPrisma.organization.findUnique.mockResolvedValueOnce({ id: 'org-1', status: 'suspended' });
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123', slug: 'test-org' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates tokens when refresh token is valid', async () => {
      const user = { ...MOCK_USER };
      const org = { ...MOCK_ORG };

      mockTokenService.validateRefreshToken.mockResolvedValueOnce(true);
      mockTokenService.revokeRefreshToken.mockResolvedValueOnce(undefined);
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      mockTokenService.generateTokens.mockResolvedValueOnce({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenId: 'new-token-id',
      });

      const result = await service.refresh('user-1:old-token-id');

      expect(result.access_token).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'user-1',
        'old-token-id',
      );
    });

    it('throws UnauthorizedException for invalid refresh token', async () => {
      mockTokenService.validateRefreshToken.mockResolvedValueOnce(false);

      await expect(service.refresh('user-1:invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
