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

describe('Manual content edits (editor save)', () => {
  it('creates a new version each save, never overwriting the previous one', async () => {
    const token = await registerAndGetToken('manual-edit@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);
    const base = `/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`;

    const firstSave = await request(app)
      .put(`${base}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'First draft.' });
    expect(firstSave.status).toBe(201);
    expect(firstSave.body.data.versionNumber).toBe(1);
    expect(firstSave.body.data.source).toBe('manual_edit');

    const secondSave = await request(app)
      .put(`${base}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Revised draft.' });
    expect(secondSave.body.data.versionNumber).toBe(2);

    const versionsRes = await request(app).get(`${base}/versions`).set('Authorization', `Bearer ${token}`);
    expect(versionsRes.body.data).toHaveLength(2);

    const currentRes = await request(app).get(base).set('Authorization', `Bearer ${token}`);
    expect(currentRes.body.data.currentContent).toBe('Revised draft.');
  });

  it("404s saving into another user's section", async () => {
    const ownerToken = await registerAndGetToken('manual-owner@example.com');
    const intruderToken = await registerAndGetToken('manual-intruder@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(ownerToken);

    const res = await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ content: 'Hijack attempt.' });
    expect(res.status).toBe(404);
  });

  it('rejects an empty content body', async () => {
    const token = await registerAndGetToken('manual-empty@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const res = await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});
