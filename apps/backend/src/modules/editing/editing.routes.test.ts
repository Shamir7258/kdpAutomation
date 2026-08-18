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
    .send({ name: 'Fitness Guide', bookType: 'how_to_guide', niche: 'home workouts for busy parents' });
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

describe.skipIf(!redisUp)('Editing pipeline routes (enqueue only — no worker wait, avoids known contention flakiness)', () => {
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

  it('rejects running the pipeline before the section has any content', async () => {
    const token = await registerAndGetToken('edit-route-empty@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const res = await request(app)
      .post(`/api/projects/${projectId}/chapters/${chapterId}/sections/${sectionId}/edit-passes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('enqueues a job (queueName "editing") once the section has content', async () => {
    const token = await registerAndGetToken('edit-route-owner@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);
    await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'A short draft to run the editing pipeline against.' });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chapters/${chapterId}/sections/${sectionId}/edit-passes`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('pending');

    const jobsRes = await request(app).get(`/api/projects/${projectId}/jobs`).set('Authorization', `Bearer ${token}`);
    expect(jobsRes.body.data.some((j: { queueName: string }) => j.queueName === 'editing')).toBe(true);
  });

  it("404s enqueueing the pipeline for another user's section", async () => {
    const ownerToken = await registerAndGetToken('edit-route-owner2@example.com');
    const intruderToken = await registerAndGetToken('edit-route-intruder@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(ownerToken);
    await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ content: 'Owner content.' });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chapters/${chapterId}/sections/${sectionId}/edit-passes`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});
