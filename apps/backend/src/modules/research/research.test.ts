import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { MockAIProvider } from '@kdp/ai';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';

let app: Express;

beforeAll(async () => {
  await startTestDb();
  await promptTemplateService.seedDefaults();
  setAIProviderForTesting(new MockAIProvider());
  app = createApp();
});
afterEach(async () => {
  await clearTestDb();
  await promptTemplateService.seedDefaults();
});
afterAll(async () => {
  setAIProviderForTesting(undefined);
  await stopTestDb();
});

async function registerAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Sup3rSecret!', name: 'Test User' });
  return res.body.data.accessToken as string;
}

async function createProject(token: string): Promise<string> {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fitness Journal', bookType: 'how_to_guide', niche: 'home workouts' });
  return res.body.data.id as string;
}

describe('Research', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects/000000000000000000000000/research').send({});
    expect(res.status).toBe(401);
  });

  it('generates a research report and marks workflowStatus.RESEARCH completed', async () => {
    const token = await registerAndGetToken('research-owner@example.com');
    const projectId = await createProject(token);

    const res = await request(app)
      .post(`/api/projects/${projectId}/research`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.nicheSummary).toBeTruthy();
    expect(Array.isArray(res.body.data.riskWarnings)).toBe(true);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(projectRes.body.data.workflowStatus.RESEARCH).toBe('completed');
  });

  it('lists research runs newest first and getLatest returns the most recent', async () => {
    const token = await registerAndGetToken('research-list@example.com');
    const projectId = await createProject(token);

    await request(app).post(`/api/projects/${projectId}/research`).set('Authorization', `Bearer ${token}`).send({});
    await request(app).post(`/api/projects/${projectId}/research`).set('Authorization', `Bearer ${token}`).send({});

    const listRes = await request(app).get(`/api/projects/${projectId}/research`).set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.length).toBe(2);

    const latestRes = await request(app)
      .get(`/api/projects/${projectId}/research/latest`)
      .set('Authorization', `Bearer ${token}`);
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.data.id).toBe(listRes.body.data[0].id);
  });

  it('404s getLatest when no research has been generated', async () => {
    const token = await registerAndGetToken('research-none@example.com');
    const projectId = await createProject(token);
    const res = await request(app).get(`/api/projects/${projectId}/research/latest`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("404s when generating research for another user's project", async () => {
    const ownerToken = await registerAndGetToken('research-owner2@example.com');
    const intruderToken = await registerAndGetToken('research-intruder@example.com');
    const projectId = await createProject(ownerToken);

    const res = await request(app)
      .post(`/api/projects/${projectId}/research`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({});
    expect(res.status).toBe(404);
  });
});
