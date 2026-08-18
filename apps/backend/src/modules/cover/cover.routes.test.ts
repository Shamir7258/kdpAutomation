import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { MockAIProvider, MockImageProvider } from '@kdp/ai';
import { loadConfig } from '@kdp/config';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { isRedisAvailable } from '../../test/queue-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { setImageProviderForTesting } from '../ai/image-provider.instance.js';
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

async function createProjectWithSpecification(token: string): Promise<{ projectId: string }> {
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

  return { projectId };
}

describe.skipIf(!redisUp)('Cover generation routes (enqueue only — no worker wait, avoids known contention flakiness)', () => {
  beforeAll(async () => {
    await startTestDb();
    await promptTemplateService.seedDefaults();
    setAIProviderForTesting(new MockAIProvider());
    setImageProviderForTesting(new MockImageProvider());
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
    setImageProviderForTesting(undefined);
    await stopTestDb();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects/000000000000000000000000/cover').send({ paperType: 'white' });
    expect(res.status).toBe(401);
  });

  it('rejects generating a cover before a specification exists', async () => {
    const token = await registerAndGetToken('cover-nospec@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Spec Yet', bookType: 'how_to_guide', niche: 'testing' });

    const res = await request(app)
      .post(`/api/projects/${projectRes.body.data.id}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paperType: 'white' });
    // bookSpecificationService.getByProject throws AppError.notFound (404), not 400.
    expect(res.status).toBe(404);
  });

  it('enqueues a job (queueName "cover-generation") once a specification exists', async () => {
    const token = await registerAndGetToken('cover-owner@example.com');
    const { projectId } = await createProjectWithSpecification(token);

    const res = await request(app)
      .post(`/api/projects/${projectId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .send({ paperType: 'white' });
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('pending');

    const jobsRes = await request(app).get(`/api/projects/${projectId}/jobs`).set('Authorization', `Bearer ${token}`);
    const job = jobsRes.body.data.find((j: { queueName: string }) => j.queueName === 'cover-generation');
    expect(job).toBeDefined();
    expect(job.chapterId).toBeNull();
    expect(job.sectionId).toBeNull();
  });

  it('lists covers (empty until a job actually completes) and 404s for a non-owner', async () => {
    const ownerToken = await registerAndGetToken('cover-owner2@example.com');
    const { projectId } = await createProjectWithSpecification(ownerToken);

    const listRes = await request(app).get(`/api/projects/${projectId}/cover`).set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);

    const intruderToken = await registerAndGetToken('cover-intruder@example.com');
    const res = await request(app).get(`/api/projects/${projectId}/cover`).set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});
