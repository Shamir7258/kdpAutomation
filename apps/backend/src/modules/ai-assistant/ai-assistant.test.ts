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

function assistantUrl(projectId: string, chapterId: string, sectionId: string): string {
  return `/api/projects/${projectId}/chapters/${chapterId}/sections/${sectionId}/assistant`;
}

describe('AI Assistant', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post(assistantUrl('000000000000000000000000', '000000000000000000000000', '000000000000000000000000'))
      .send({ action: 'rewrite' });
    expect(res.status).toBe(401);
  });

  it('rewrites explicitly provided selected text without requiring saved content', async () => {
    const token = await registerAndGetToken('assistant-rewrite@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const res = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'rewrite', selectedText: 'This is my draft sentence.' });

    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('text');
    expect(res.body.data.text.length).toBeGreaterThan(0);
  });

  it('400s when no selection is given and the section has no content yet', async () => {
    const token = await registerAndGetToken('assistant-empty@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const res = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'improve' });
    expect(res.status).toBe(400);
  });

  it('falls back to the section current content when no selection is given', async () => {
    const token = await registerAndGetToken('assistant-fallback@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);
    await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Manually written section content.' });

    const res = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'expand' });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('text');
  });

  it('requires ageRange for age_appropriate and instruction for custom', async () => {
    const token = await registerAndGetToken('assistant-validation@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const ageRes = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'age_appropriate', selectedText: 'Some text' });
    expect(ageRes.status).toBe(400);

    const customRes = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'custom', selectedText: 'Some text' });
    expect(customRes.status).toBe(400);
  });

  it('returns multiple alternatives for the alternatives action', async () => {
    const token = await registerAndGetToken('assistant-alternatives@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const res = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'alternatives', selectedText: 'Some text', count: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('alternatives');
    expect(Array.isArray(res.body.data.alternatives)).toBe(true);
  });

  it('returns a structured analysis for fact_check', async () => {
    const token = await registerAndGetToken('assistant-factcheck@example.com');
    const { projectId, chapterId, sectionId } = await createProjectWithOutline(token);

    const res = await request(app)
      .post(assistantUrl(projectId, chapterId, sectionId))
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'fact_check', selectedText: 'The sky is blue.' });
    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('analysis');
    expect(res.body.data.summary).toBeTruthy();
    expect(Array.isArray(res.body.data.findings)).toBe(true);
  });
});
