import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { MockAIProvider } from '@kdp/ai';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { UserModel } from '../auth/user.model.js';
import { BookSpecificationModel } from '../book-specifications/book-specification.model.js';
import { MetadataModel } from '../metadata/metadata.model.js';
import { InteriorModel } from '../interior/interior.model.js';
import { CoverModel } from '../cover/cover.model.js';

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

describe('Validation report', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/projects/000000000000000000000000/validation');
    expect(res.status).toBe(401);
  });

  it('reports every prerequisite missing for a brand-new project', async () => {
    const token = await registerAndGetToken('validation-empty@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fitness Journal', bookType: 'how_to_guide', niche: 'fitness for beginners' });

    const res = await request(app)
      .get(`/api/projects/${projectRes.body.data.id}/validation`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.readyToPublish).toBe(false);
    const ruleIds = res.body.data.findings.map((f: { ruleId: string }) => f.ruleId);
    expect(ruleIds).toContain('outline-exists');
    expect(ruleIds).toContain('metadata-exists');
    expect(ruleIds).toContain('interior-exists');
    expect(ruleIds).toContain('cover-exists');
  });

  it('404s for a project the caller does not own', async () => {
    const ownerToken = await registerAndGetToken('validation-owner@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Fitness Journal', bookType: 'journal', niche: 'fitness' });

    const intruderToken = await registerAndGetToken('validation-intruder@example.com');
    const res = await request(app)
      .get(`/api/projects/${projectRes.body.data.id}/validation`)
      .set('Authorization', `Bearer ${intruderToken}`);
    expect(res.status).toBe(404);
  });

  it('reports readyToPublish once every prerequisite is satisfied', async () => {
    const token = await registerAndGetToken('validation-ready@example.com');
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Deep Work Guide', bookType: 'how_to_guide', niche: 'remote work productivity' });
    const projectId = projectRes.body.data.id as string;

    const user = await UserModel.findOne({ email: 'validation-ready@example.com' });

    await BookSpecificationModel.create({
      projectId,
      userId: user!._id,
      ideaId: user!._id,
      workingTitle: 'Deep Work Guide',
      subtitle: '',
      audience: 'remote workers',
      tone: 'friendly',
      readingLevel: 'general',
      language: 'en',
      trimSizeId: '6x9',
      estimatedPageCount: 180,
      chapterCount: 1,
    });

    const outlineRes = await request(app).post(`/api/projects/${projectId}/outline`).set('Authorization', `Bearer ${token}`);
    const chapterId = outlineRes.body.data[0].id as string;
    const sectionId = outlineRes.body.data[0].sections[0].id as string;
    await request(app)
      .put(`/api/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}/manual`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Real generated content for this section.' });

    await MetadataModel.create({
      projectId,
      userId: user!._id,
      title: 'Deep Work Guide',
      subtitle: '',
      seriesName: '',
      description: 'A practical guide to staying focused while working from anywhere.',
      keywords: ['remote work', 'productivity', 'focus', 'deep work', 'time management', 'home office', 'wfh'],
      categories: ['Business & Money > Skills'],
      authorName: 'Jane Publisher',
      primaryMarketplace: 'amazon.com',
      aiSuggestions: { titles: [], subtitles: [], description: '', keywords: [], categories: [] },
    });

    await InteriorModel.create({
      projectId,
      userId: user!._id,
      batchId: 'batch-1',
      format: 'pdf',
      trimSizeId: '6x9',
      storageKey: 'interiors/x/y/z.pdf',
      url: '/api/files/interiors/x/y/z.pdf',
      fileSizeBytes: 12345,
      pageCount: 180,
    });

    await CoverModel.create({
      projectId,
      userId: user!._id,
      batchId: 'batch-1',
      paperType: 'white',
      pageCount: 180,
      spineWidthIn: 0.405,
      ebookCoverStorageKey: 'covers/x/y/z-ebook.png',
      ebookCoverUrl: '/api/files/covers/x/y/z-ebook.png',
      wrapCoverPdfStorageKey: 'covers/x/y/z-wrap.pdf',
      wrapCoverPdfUrl: '/api/files/covers/x/y/z-wrap.pdf',
    });

    const res = await request(app).get(`/api/projects/${projectId}/validation`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.findings).toEqual([]);
    expect(res.body.data.readyToPublish).toBe(true);
  });
});
