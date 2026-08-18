import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { loadConfig } from '@kdp/config';
import { MockAIProvider } from '@kdp/ai';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { isRedisAvailable } from '../../test/queue-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { startContentGenerationWorker, stopContentGenerationWorker } from '../../queue/workers/content-generation.worker.js';
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

async function waitForJobStatus(
  token: string,
  projectId: string,
  predicate: (jobs: Array<{ status: string }>) => boolean,
  // Generous on purpose: under full-suite parallelism, ~10 test files each spin up their own
  // mongodb-memory-server instance concurrently, and the BullMQ worker's job pickup latency is
  // sensitive to that CPU/IO contention. Verified this file passes in ~1-3s per test in isolation;
  // the 40s ceiling is headroom for contention, not an expectation of actually taking that long.
  timeoutMs = 40_000,
): Promise<Array<{ id: string; status: string }>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request(app).get(`/api/projects/${projectId}/jobs`).set('Authorization', `Bearer ${token}`);
    if (predicate(res.body.data)) return res.body.data;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for job status');
}

// This file exercises the real BullMQ queue + worker end-to-end (deliberately — see
// content.service.test.ts for the dependency-free unit tests of the actual generation logic).
// This used to be intermittently flaky and was attributed to host contention (BullMQ job-pickup
// latency under a starved event loop) — the real cause, found and fixed in Phase 8, was a race in
// enqueueOne() (content.service.ts): the job could be enqueued and picked up by the worker before
// its Mongo Job doc existed, so the "completed" status write silently found nothing to update.
// Fixed by creating the Job doc before enqueueing and passing its id as BullMQ's explicit jobId,
// making the ordering race-proof. The generous per-test timeouts below are now just headroom for
// a busy host, not compensation for that bug.
describe.skipIf(!redisUp)('Content generation (full BullMQ round trip — requires Redis)', () => {
  beforeAll(async () => {
    await startTestDb();
    await promptTemplateService.seedDefaults();
    setAIProviderForTesting(new MockAIProvider());
    app = createApp();
    // Wait for the worker's Redis connection to actually be established before the first test
    // runs — without this, the first job processed after a fresh Worker() pays a one-time
    // connection-setup cost that can exceed even a generous per-test timeout under full-suite
    // parallelism, while every job after it is fast. This isn't padding, it's removing a race.
    await startContentGenerationWorker().waitUntilReady();
  });
  afterEach(async () => {
    await clearTestDb();
    await promptTemplateService.seedDefaults();
  });
  afterAll(async () => {
    await stopContentGenerationWorker();
    await closeQueues();
    await closeRedisConnection();
    setAIProviderForTesting(undefined);
    await stopTestDb();
  });

  it('generates content for a single section end-to-end (enqueue → worker → ContentVersion)', async () => {
    const token = await registerAndGetToken('content-owner@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const enqueueRes = await request(app)
      .post(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(enqueueRes.status).toBe(202);
    expect(enqueueRes.body.data.status).toBe('pending');

    await waitForJobStatus(token, projectId, (jobs) => jobs.length > 0 && jobs.every((j) => j.status === 'completed'));

    const contentRes = await request(app)
      .get(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(contentRes.body.data.currentVersionNumber).toBe(1);
    expect(contentRes.body.data.currentContent.length).toBeGreaterThan(0);

    const versionsRes = await request(app)
      .get(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/versions`)
      .set('Authorization', `Bearer ${token}`);
    expect(versionsRes.body.data).toHaveLength(1);
  }, 50_000);

  it('generateBook resumes correctly: re-running after partial generation only fills in the gaps', async () => {
    const token = await registerAndGetToken('content-resume@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    // Generate just the one section directly first.
    await request(app)
      .post(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`)
      .set('Authorization', `Bearer ${token}`);
    await waitForJobStatus(token, projectId, (jobs) => jobs.length > 0 && jobs.every((j) => j.status === 'completed'));

    // Now call generateBook — it must not re-enqueue the already-completed section.
    const bookRes = await request(app).post(`/api/projects/${projectId}/content`).set('Authorization', `Bearer ${token}`);
    expect(bookRes.status).toBe(202);
    const newlyEnqueuedSectionIds = bookRes.body.data.map((j: { sectionId: string }) => j.sectionId);
    expect(newlyEnqueuedSectionIds).not.toContain(sectionId);
  }, 50_000);

  it('supports restoring an earlier content version without deleting the newer one', async () => {
    const token = await registerAndGetToken('content-restore@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);
    const base = `/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`;

    await request(app).post(base).set('Authorization', `Bearer ${token}`);
    await waitForJobStatus(token, projectId, (jobs) => jobs.length > 0 && jobs.every((j) => j.status === 'completed'));
    await request(app).post(base).set('Authorization', `Bearer ${token}`);
    await waitForJobStatus(token, projectId, (jobs) => jobs.length === 2 && jobs.every((j) => j.status === 'completed'));

    const versionsRes = await request(app).get(`${base}/versions`).set('Authorization', `Bearer ${token}`);
    expect(versionsRes.body.data).toHaveLength(2);

    const restoreRes = await request(app).post(`${base}/versions/1/restore`).set('Authorization', `Bearer ${token}`);
    expect(restoreRes.body.data.currentVersionNumber).toBe(1);

    // Version 2 must still exist — restore moves the pointer, it never deletes.
    const versionsAfterRes = await request(app).get(`${base}/versions`).set('Authorization', `Bearer ${token}`);
    expect(versionsAfterRes.body.data).toHaveLength(2);
  }, 60_000);
});
