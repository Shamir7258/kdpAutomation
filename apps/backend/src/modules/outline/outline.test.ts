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

async function createProjectWithSpec(token: string, bookType = 'how_to_guide'): Promise<string> {
  const projectRes = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fitness Guide', bookType, niche: 'home workouts for busy parents' });
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

describe('Outline', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/projects/000000000000000000000000/outline').send({});
    expect(res.status).toBe(401);
  });

  it('generates a full outline with chapters and sections, and marks workflowStatus.OUTLINE completed', async () => {
    const token = await registerAndGetToken('outline-owner@example.com');
    const projectId = await createProjectWithSpec(token);

    const res = await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].sections.length).toBeGreaterThan(0);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(projectRes.body.data.workflowStatus.OUTLINE).toBe('completed');
  });

  it('rejects outline generation for a book type that does not support outlines', async () => {
    const token = await registerAndGetToken('outline-lowcontent@example.com');
    const projectId = await createProjectWithSpec(token, 'journal');

    const res = await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('supports manual chapter add/rename/delete/reorder', async () => {
    const token = await registerAndGetToken('outline-manual@example.com');
    const projectId = await createProjectWithSpec(token);
    await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);

    const addRes = await request(app)
      .post(`/api/projects/${projectId}/outline/chapters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bonus Chapter', summary: 'Extra content' });
    expect(addRes.status).toBe(201);
    const newChapterId = addRes.body.data.id as string;

    const renameRes = await request(app)
      .patch(`/api/projects/${projectId}/outline/chapters/${newChapterId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed Bonus Chapter' });
    expect(renameRes.body.data.title).toBe('Renamed Bonus Chapter');

    const listRes = await request(app).get(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    const allIds = listRes.body.data.map((c: { id: string }) => c.id) as string[];
    const reversedIds = [...allIds].reverse();

    const reorderRes = await request(app)
      .post(`/api/projects/${projectId}/outline/chapters/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({ chapterIds: reversedIds });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.data[0].id).toBe(reversedIds[0]);

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/outline/chapters/${newChapterId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const finalList = await request(app).get(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    expect(finalList.body.data.find((c: { id: string }) => c.id === newChapterId)).toBeUndefined();
  });

  it('regenerates a chapter (replacing its sections) and a single section', async () => {
    const token = await registerAndGetToken('outline-regen@example.com');
    const projectId = await createProjectWithSpec(token);
    const genRes = await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    const chapterId = genRes.body.data[0].id as string;

    const regenChapterRes = await request(app)
      .post(`/api/projects/${projectId}/outline/chapters/${chapterId}/regenerate`)
      .set('Authorization', `Bearer ${token}`);
    expect(regenChapterRes.status).toBe(200);
    expect(regenChapterRes.body.data.sections.length).toBeGreaterThan(0);

    const sectionId = regenChapterRes.body.data.sections[0].id as string;
    const regenSectionRes = await request(app)
      .post(`/api/projects/${projectId}/outline/chapters/${chapterId}/sections/${sectionId}/regenerate`)
      .set('Authorization', `Bearer ${token}`);
    expect(regenSectionRes.status).toBe(200);
    expect(regenSectionRes.body.data.id).toBe(sectionId);
  });

  it('supports manual section add/rename/delete/reorder within a chapter', async () => {
    const token = await registerAndGetToken('outline-sections@example.com');
    const projectId = await createProjectWithSpec(token);
    const genRes = await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    const chapterId = genRes.body.data[0].id as string;

    const addRes = await request(app)
      .post(`/api/projects/${projectId}/outline/chapters/${chapterId}/sections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'New Section', summary: 'Details' });
    expect(addRes.status).toBe(201);
    const sectionId = addRes.body.data.id as string;

    const updateRes = await request(app)
      .patch(`/api/projects/${projectId}/outline/chapters/${chapterId}/sections/${sectionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Renamed Section' });
    expect(updateRes.body.data.title).toBe('Renamed Section');

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/outline/chapters/${chapterId}/sections/${sectionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
  });

  it("404s outline generation for another user's project", async () => {
    const ownerToken = await registerAndGetToken('outline-owner2@example.com');
    const intruderToken = await registerAndGetToken('outline-intruder@example.com');
    const projectId = await createProjectWithSpec(ownerToken);

    const res = await request(app)
      .post(`/api/projects/${projectId}/outline`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });
});
