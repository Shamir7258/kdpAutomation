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
import { InteriorModel } from '../interior/interior.model.js';
import { CoverModel } from '../cover/cover.model.js';

const redisUp = await isRedisAvailable(loadConfig().REDIS_URL);

let app: Express;

async function registerAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Sup3rSecret!', name: 'Test User' });
  return res.body.data.accessToken as string;
}

async function createProject(token: string): Promise<{ projectId: string; userId: string }> {
  const res = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Deep Work Guide', bookType: 'how_to_guide', niche: 'remote work productivity' });
  const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  return { projectId: res.body.data.id as string, userId: meRes.body.data.id as string };
}

describe.skipIf(!redisUp)('Export routes (enqueue only — no worker wait, avoids known contention flakiness)', () => {
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
    const res = await request(app).post('/api/projects/000000000000000000000000/export');
    expect(res.status).toBe(401);
  });

  it('rejects generating an export before an interior exists', async () => {
    const token = await registerAndGetToken('export-nointerior@example.com');
    const { projectId } = await createProject(token);

    const res = await request(app).post(`/api/projects/${projectId}/export`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects generating an export when an interior exists but no cover does', async () => {
    const token = await registerAndGetToken('export-nocover@example.com');
    const { projectId, userId } = await createProject(token);
    await InteriorModel.create({
      projectId,
      userId,
      batchId: 'batch-1',
      format: 'pdf',
      trimSizeId: '6x9',
      storageKey: 'interiors/x/y/z.pdf',
      url: '/api/files/interiors/x/y/z.pdf',
      fileSizeBytes: 1234,
    });

    const res = await request(app).post(`/api/projects/${projectId}/export`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('enqueues a job (queueName "export") once both an interior and a cover exist', async () => {
    const token = await registerAndGetToken('export-owner@example.com');
    const { projectId, userId } = await createProject(token);
    await InteriorModel.create({
      projectId,
      userId,
      batchId: 'batch-1',
      format: 'pdf',
      trimSizeId: '6x9',
      storageKey: 'interiors/x/y/z.pdf',
      url: '/api/files/interiors/x/y/z.pdf',
      fileSizeBytes: 1234,
    });
    await CoverModel.create({
      projectId,
      userId,
      batchId: 'batch-1',
      paperType: 'white',
      pageCount: 120,
      spineWidthIn: 0.27,
      ebookCoverStorageKey: 'covers/x/y/z-ebook.png',
      ebookCoverUrl: '/api/files/covers/x/y/z-ebook.png',
      wrapCoverPdfStorageKey: 'covers/x/y/z-wrap.pdf',
      wrapCoverPdfUrl: '/api/files/covers/x/y/z-wrap.pdf',
    });

    const res = await request(app).post(`/api/projects/${projectId}/export`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('pending');

    const jobsRes = await request(app).get(`/api/projects/${projectId}/jobs`).set('Authorization', `Bearer ${token}`);
    const job = jobsRes.body.data.find((j: { queueName: string }) => j.queueName === 'export');
    expect(job).toBeDefined();
    expect(job.chapterId).toBeNull();
    expect(job.sectionId).toBeNull();
  });

  it('lists exports (empty until a job actually completes) and 404s for a non-owner', async () => {
    const ownerToken = await registerAndGetToken('export-owner2@example.com');
    const { projectId } = await createProject(ownerToken);

    const listRes = await request(app).get(`/api/projects/${projectId}/export`).set('Authorization', `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual([]);

    const intruderToken = await registerAndGetToken('export-intruder@example.com');
    const res = await request(app).get(`/api/projects/${projectId}/export`).set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});
