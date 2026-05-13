import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const baseEmail = `e2e-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates org and admin user, returns 201 with access_token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'E2E User',
          email: baseEmail,
          password: 'password123',
          orgName: 'E2E Org',
          niche: 'real_estate',
        })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.email).toBe(baseEmail);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.organization.niche).toBe('real_estate');
      expect(res.headers['set-cookie']).toBeDefined();

      accessToken = res.body.access_token as string;
    });

    it('returns 400 for invalid niche', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test',
          email: 'niche@test.com',
          password: 'password123',
          orgName: 'Test Org',
          niche: 'nonexistent_niche',
        })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns current user with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.user.email).toBe(baseEmail);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns 401 with expired/invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('POST /auth/login', () => {
    it('authenticates user and returns access_token + cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: baseEmail, password: 'password123' })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
      accessToken = res.body.access_token as string;
    });

    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: baseEmail, password: 'wrong-password' })
        .expect(401);
    });

    it('returns 401 for nonexistent email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'any' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues new access_token and rotates cookie', async () => {
      // First login to get a fresh cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: baseEmail, password: 'password123' })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'] as string[];
      expect(cookie).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(200);

      expect(refreshRes.body.access_token).toBeDefined();
      expect(refreshRes.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 without cookie', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes token, clears cookie, returns 204', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: baseEmail, password: 'password123' })
        .expect(200);

      const cookie = loginRes.headers['set-cookie'] as string[];
      const token = loginRes.body.access_token as string;

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookie)
        .expect(204);

      // Refresh with revoked token should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('returns 401 without access token', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    });
  });
});
