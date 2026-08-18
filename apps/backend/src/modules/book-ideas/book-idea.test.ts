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
    .send({ name: 'Fitness Journal', bookType: 'journal', niche: 'fitness for beginners' });
  return res.body.data.id as string;
}

describe('Book idea generation', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects/000000000000000000000000/ideas').send({});
    expect(res.status).toBe(401);
  });

  it('generates ideas for an owned project using the injected mock provider', async () => {
    const token = await registerAndGetToken('idea-owner@example.com');
    const projectId = await createProject(token);

    const res = await request(app)
      .post(`/api/projects/${projectId}/ideas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 3 });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('title');
    expect(res.body.data[0].status).toBe('proposed');
  });

  it('advances project status from DRAFT to PLANNING after generating ideas', async () => {
    const token = await registerAndGetToken('idea-status@example.com');
    const projectId = await createProject(token);

    await request(app).post(`/api/projects/${projectId}/ideas`).set('Authorization', `Bearer ${token}`).send({});

    const projectRes = await request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(projectRes.body.data.status).toBe('PLANNING');
    expect(projectRes.body.data.workflowStatus.IDEA).toBe('completed');
  });

  it('404s when generating ideas for another user\'s project', async () => {
    const ownerToken = await registerAndGetToken('idea-owner2@example.com');
    const intruderToken = await registerAndGetToken('idea-intruder@example.com');
    const projectId = await createProject(ownerToken);

    const res = await request(app)
      .post(`/api/projects/${projectId}/ideas`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('lists generated ideas and allows updating status to saved/rejected', async () => {
    // Two separate generate calls (rather than count:2) — MockAIProvider's schema-walker
    // always returns a 1-element array for an array field, since it has no concept of
    // "count"; the real providers honor count via the prompt. Two calls also exercises
    // "regenerate appends, never replaces" (see book-idea.service.ts docstring).
    const token = await registerAndGetToken('idea-list@example.com');
    const projectId = await createProject(token);

    await request(app).post(`/api/projects/${projectId}/ideas`).set('Authorization', `Bearer ${token}`).send({});
    await request(app).post(`/api/projects/${projectId}/ideas`).set('Authorization', `Bearer ${token}`).send({});
    const listRes = await request(app).get(`/api/projects/${projectId}/ideas`).set('Authorization', `Bearer ${token}`);
    expect(listRes.body.data.length).toBe(2);

    const ideaId = listRes.body.data[0].id as string;
    const rejectRes = await request(app)
      .patch(`/api/projects/${projectId}/ideas/${ideaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'rejected' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');
  });

  it('records AI usage for a generation call', async () => {
    const token = await registerAndGetToken('idea-usage@example.com');
    const projectId = await createProject(token);
    await request(app).post(`/api/projects/${projectId}/ideas`).set('Authorization', `Bearer ${token}`).send({});

    const dashRes = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
    expect(dashRes.body.data.aiUsage.totalCalls).toBeGreaterThan(0);
  });
});
