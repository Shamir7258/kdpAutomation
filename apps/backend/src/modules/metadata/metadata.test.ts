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

async function createProjectWithSpec(token: string): Promise<string> {
  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fitness Journal', bookType: 'how_to_guide', niche: 'fitness for beginners' });
  const projectId = projectRes.body.data.id as string;

  const ideasRes = await request(app)
    .post(`/api/projects/${projectId}/ideas`)
    .set('Authorization', `Bearer ${token}`)
    .send({ count: 1 });
  const ideaId = ideasRes.body.data[0].id as string;

  await request(app)
    .post(`/api/projects/${projectId}/specification`)
    .set('Authorization', `Bearer ${token}`)
    .send({ ideaId });

  return projectId;
}

describe('Metadata generation', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects/000000000000000000000000/metadata');
    expect(res.status).toBe(401);
  });

  it('generates metadata seeded from AI suggestions and marks the workflow stage completed', async () => {
    const token = await registerAndGetToken('meta-owner@example.com');
    const projectId = await createProjectWithSpec(token);

    const res = await request(app).post(`/api/projects/${projectId}/metadata`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(res.body.data.aiSuggestions.titles[0]);
    expect(res.body.data.keywords.length).toBeLessThanOrEqual(7);
    expect(res.body.data.categories.length).toBeLessThanOrEqual(2);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(projectRes.body.data.workflowStatus.METADATA).toBe('completed');
  });

  it('404s generating metadata before a specification exists', async () => {
    const token = await registerAndGetToken('meta-nospec@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Spec Yet', bookType: 'journal', niche: 'fitness' });

    const res = await request(app)
      .post(`/api/projects/${projectRes.body.data.id}/metadata`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('404s fetching metadata before it has been generated', async () => {
    const token = await registerAndGetToken('meta-missing@example.com');
    const projectId = await createProjectWithSpec(token);

    const res = await request(app).get(`/api/projects/${projectId}/metadata`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('lets the publisher finalize fields with PATCH without discarding the AI suggestions', async () => {
    const token = await registerAndGetToken('meta-patch@example.com');
    const projectId = await createProjectWithSpec(token);
    await request(app).post(`/api/projects/${projectId}/metadata`).set('Authorization', `Bearer ${token}`);

    const patchRes = await request(app)
      .patch(`/api/projects/${projectId}/metadata`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'The Final Title',
        keywords: ['fitness', 'beginners', 'home workout'],
        authorName: 'Jane Publisher',
        pricing: { currency: 'USD', listPrice: 9.99 },
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.title).toBe('The Final Title');
    expect(patchRes.body.data.keywords).toEqual(['fitness', 'beginners', 'home workout']);
    expect(patchRes.body.data.authorName).toBe('Jane Publisher');
    expect(patchRes.body.data.pricing).toEqual({ currency: 'USD', listPrice: 9.99 });
    expect(patchRes.body.data.aiSuggestions.titles.length).toBeGreaterThan(0);
  });

  it('rejects more than 7 keywords', async () => {
    const token = await registerAndGetToken('meta-toomanykw@example.com');
    const projectId = await createProjectWithSpec(token);
    await request(app).post(`/api/projects/${projectId}/metadata`).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/projects/${projectId}/metadata`)
      .set('Authorization', `Bearer ${token}`)
      .send({ keywords: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
    expect(res.status).toBe(400);
  });

  it('404s when another user tries to generate or fetch metadata for a project they do not own', async () => {
    const ownerToken = await registerAndGetToken('meta-owner2@example.com');
    const projectId = await createProjectWithSpec(ownerToken);
    await request(app).post(`/api/projects/${projectId}/metadata`).set('Authorization', `Bearer ${ownerToken}`);

    const otherToken = await registerAndGetToken('meta-intruder@example.com');
    const res = await request(app).get(`/api/projects/${projectId}/metadata`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
