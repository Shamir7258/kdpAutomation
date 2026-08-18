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

async function createProjectWithIdea(token: string): Promise<{ projectId: string; ideaId: string }> {
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

  return { projectId, ideaId };
}

describe('Book specification', () => {
  it('creates a specification from a saved idea and marks the idea saved', async () => {
    const token = await registerAndGetToken('spec-owner@example.com');
    const { projectId, ideaId } = await createProjectWithIdea(token);

    const specRes = await request(app)
      .post(`/api/projects/${projectId}/specification`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ideaId, tone: 'friendly', readingLevel: 'beginner', trimSizeId: '6x9' });

    expect(specRes.status).toBe(201);
    expect(specRes.body.data.ideaId).toBe(ideaId);
    expect(specRes.body.data.trimSizeId).toBe('6x9');

    const ideaRes = await request(app).get(`/api/projects/${projectId}/ideas`).set('Authorization', `Bearer ${token}`);
    expect(ideaRes.body.data.find((i: { id: string }) => i.id === ideaId).status).toBe('saved');

    const projectRes = await request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(projectRes.body.data.workflowStatus.SPECIFICATION).toBe('completed');
  });

  it('rejects creating a second specification for the same project', async () => {
    const token = await registerAndGetToken('spec-dup@example.com');
    const { projectId, ideaId } = await createProjectWithIdea(token);

    await request(app)
      .post(`/api/projects/${projectId}/specification`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ideaId });

    const secondRes = await request(app)
      .post(`/api/projects/${projectId}/specification`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ideaId });
    expect(secondRes.status).toBe(409);
  });

  it('404s fetching a specification before one has been created', async () => {
    const token = await registerAndGetToken('spec-missing@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fitness Journal', bookType: 'journal', niche: 'fitness' });

    const res = await request(app)
      .get(`/api/projects/${projectRes.body.data.id}/specification`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
