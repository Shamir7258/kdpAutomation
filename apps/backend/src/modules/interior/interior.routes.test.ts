import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { MockAIProvider } from '@kdp/ai';
import { loadConfig } from '@kdp/config';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { isRedisAvailable } from '../../test/queue-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { closeQueues } from '../../queue/queues.js';
import { closeRedisConnection } from '../../queue/redis.js';

const redisUp = await isRedisAvailable(loadConfig().REDIS_URL);

let app: Express;

async function registerAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Sup3rSecret!', name: 'Test User' });
  return res.body.data.accessToken as string;
}

async function createProjectWithOutline(token: string): Promise<{ projectId: string; chapterId: string; sectionId: string }> {
  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Deep Work Guide', bookType: 'how_to_guide', niche: 'remote work productivity' });
  const projectId = projectRes.body.data.id as string;

  const ideasRes = await request(app)
    .post(`/api/projects/${projectId}/ideas`)
    .set('Authorization', `Bearer ${token}`)
    .send({ count: 1 });
  const ideaId = ideasRes.body.data[0].id as string;

  await request(app).post(`/api/projects/${projectId}/specification`).set('Authorization', `Bearer ${token}`).send({ ideaId });

  const outlineRes = await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
  const chapterId = outlineRes.body.data[0].id as string;
  const sectionId = outlineRes.body.data[0].sections[0].id as string;

  return { projectId, chapterId, sectionId };
}

describe.skipIf(!redisUp)('Interior generation routes (enqueue only — no worker wait, avoids known contention flakiness)', () => {
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
    await closeQueues();
    await closeRedisConnection();
    setAIProviderForTesting(undefined);
    await stopTestDb();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects/000000000000000000000000/interior').send({ format: 'pdf' });
    expect(res.status).toBe(401);
  });

  it('rejects generating an interior before the project has an outline', async () => {
    const token = await registerAndGetToken('interior-nooutline@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Outline Yet', bookType: 'how_to_guide', niche: 'testing' });

    const res = await request(app)
      .post(`/api/projects/${projectRes.body.data.id}/interior`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'pdf' });
    expect(res.status).toBe(400);
  });

  it('rejects generating an interior before any section has content', async () => {
    const token = await registerAndGetToken('interior-nocontent@example.com');
    const { projectId } = await createProjectWithOutline(token);

    const res = await request(app)
      .post(`/api/projects/${projectId}/interior`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'pdf' });
    expect(res.status).toBe(400);
  });

  it('enqueues a job (queueName "document-generation") once a section has content', async () => {
    const token = await registerAndGetToken('interior-owner@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);
    await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A short draft to render into an interior.' });

    const res = await request(app)
      .post(`/api/projects/${projectId}/interior`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'pdf' });
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('pending');

    const jobsRes = await request(app).get(`/api/projects/${projectId}/jobs`).set('Authorization', `Bearer ${token}`);
    const job = jobsRes.body.data.find((j: { queueName: string }) => j.queueName === 'document-generation');
    expect(job).toBeDefined();
    expect(job.chapterId).toBeNull();
    expect(job.sectionId).toBeNull();
  });

  it('rejects an invalid format', async () => {
    const token = await registerAndGetToken('interior-badformat@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);
    await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Some content.' });

    const res = await request(app)
      .post(`/api/projects/${projectId}/interior`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'rtf' });
    expect(res.status).toBe(400);
  });

  it('lists interiors (empty until a job actually completes) and 404s for a non-owner', async () => {
    const ownerToken = await registerAndGetToken('interior-owner2@example.com');
    const { projectId } = await createProjectWithOutline(ownerToken);

    const listRes = await request(app).get(`/api/projects/${projectId}/interior`).set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);

    const intruderToken = await registerAndGetToken('interior-intruder@example.com');
    const res = await request(app).get(`/api/projects/${projectId}/interior`).set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});
