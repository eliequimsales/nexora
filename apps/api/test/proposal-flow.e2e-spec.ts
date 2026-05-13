/**
 * E2E — Proposal acceptance flow
 *
 * Full flow: ingest lead → classify → create proposal → send → accept →
 * verify lead status is closed_won.
 *
 * Uses the mock LLM provider (NODE_ENV=test) so no real API keys are needed.
 * Classification result is the mock response from LlmService.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const ts = Date.now();

describe('Proposal Flow (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let orgSlug: string;
  let leadId: string;
  let proposalId: string;
  let proposalToken: string;
  let formToken: string;

  const USER = {
    name: 'Proposal E2E User',
    email: `proposal-e2e-${ts}@example.com`,
    password: 'password123',
    orgName: `Proposal E2E Org ${ts}`,
    niche: 'real_estate',
  };

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

  it('Step 1: register org and capture token + slug + formToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(USER)
      .expect(201);

    accessToken = res.body.access_token as string;
    orgSlug = res.body.organization.slug as string;
    expect(accessToken).toBeDefined();
    expect(orgSlug).toBeDefined();

    // Fetch full org to get formToken
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // formToken is on the org object returned by /organizations/me
    const orgRes = await request(app.getHttpServer())
      .get('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    formToken = orgRes.body.formToken as string;
    expect(formToken).toBeDefined();
  });

  it('Step 2: ingest lead via public endpoint', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/ingest/${formToken}`)
      .send({ name: 'E2E Proposal Lead', email: `proposal-lead-${ts}@example.com` })
      .expect(201);

    leadId = res.body.id as string;
    expect(leadId).toBeDefined();
  });

  it('Step 3: classify lead with AI (mock provider)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/ai-actions/classify/${leadId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Mock provider returns success; status is 'success' or execution record is returned
    expect(res.body).toBeDefined();
  });

  it('Step 4: create proposal for lead', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/proposals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        leadId,
        title: 'Proposta E2E',
        items: [{ description: 'Consultoria', quantity: 1, unitPrice: 5000 }],
      })
      .expect(201);

    proposalId = res.body.id as string;
    expect(proposalId).toBeDefined();
    expect(res.body.status).toBe('draft');
    expect(res.body.totalAmount).toBe(5000);
  });

  it('Step 5: send proposal (transitions to sent + generates token)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposalId}/send`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.status).toBe('sent');
    expect(res.body.token).toBeDefined();
    proposalToken = res.body.token as string;
  });

  it('Step 6: cannot send already-sent proposal', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/proposals/${proposalId}/send`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('Step 7: accept proposal via public endpoint (no auth)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${proposalToken}/respond`)
      .send({ action: 'accept' })
      .expect(200);
  });

  it('Step 8: cannot accept already-accepted proposal', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/public/proposals/${proposalToken}/respond`)
      .send({ action: 'accept' })
      .expect(400);
  });

  it('Step 9: lead status is closed_won after proposal acceptance', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.status).toBe('closed_won');
  });

  it('Step 10: proposal status is accepted', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/proposals/${proposalId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.status).toBe('accepted');
  });
});
