import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MockAIProvider } from '@kdp/ai';
import { LocalStorageProvider } from '@kdp/storage';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { setStorageProviderForTesting } from '../storage/storage-provider.instance.js';
import { UserModel } from '../auth/user.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { BookSpecificationModel } from '../book-specifications/book-specification.model.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';
import { runInteriorGeneration } from './interior.service.js';
import { InteriorModel } from './interior.model.js';

let storageRoot: string;

beforeAll(async () => {
  await startTestDb();
  await promptTemplateService.seedDefaults();
  setAIProviderForTesting(new MockAIProvider());
});
beforeEach(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'kdp-interior-test-'));
  setStorageProviderForTesting(new LocalStorageProvider(storageRoot));
});
afterEach(async () => {
  await clearTestDb();
  await promptTemplateService.seedDefaults();
  await rm(storageRoot, { recursive: true, force: true });
});
afterAll(async () => {
  setAIProviderForTesting(undefined);
  setStorageProviderForTesting(undefined);
  await stopTestDb();
});

async function seedBookWithGeneratedContent() {
  const user = await UserModel.create({ email: 'interior-gen@example.com', passwordHash: 'x', name: 'Gen', role: 'user' });
  const project = await ProjectModel.create({
    userId: user._id,
    name: 'Deep Work for Remote Workers',
    bookType: 'how_to_guide',
    niche: 'remote work productivity',
    status: 'GENERATING',
  });
  await BookSpecificationModel.create({
    projectId: project._id,
    userId: user._id,
    ideaId: user._id,
    workingTitle: 'Deep Work for Remote Workers',
    subtitle: 'Focus without an office',
    audience: 'remote employees',
    tone: 'friendly',
    readingLevel: 'general',
    language: 'en',
    trimSizeId: '6x9',
    estimatedPageCount: 120,
    chapterCount: 1,
  });
  const chapter = await ChapterModel.create({ projectId: project._id, userId: user._id, title: 'Getting Started', summary: 'Intro', order: 0 });
  const section = await SectionModel.create({
    chapterId: chapter._id,
    projectId: project._id,
    userId: user._id,
    title: 'Why Focus Matters',
    summary: 'Motivation',
    order: 0,
    currentVersion: 1,
  });
  await ContentVersionModel.create({
    sectionId: section._id,
    chapterId: chapter._id,
    projectId: project._id,
    userId: user._id,
    versionNumber: 1,
    content: '# Why Focus Matters\n\nA short paragraph of generated content.\n\n- one\n- two',
    source: 'ai_generated',
  });
  return { user, project, chapter, section };
}

describe('runInteriorGeneration (unit — no queue/Redis)', () => {
  it('renders a PDF, stores it, records an Interior document, and marks the workflow stage completed', async () => {
    const { user, project } = await seedBookWithGeneratedContent();

    await runInteriorGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      format: 'pdf',
      trimSizeId: '6x9',
      batchId: 'batch-1',
    });

    const interiors = await InteriorModel.find({ projectId: project._id });
    expect(interiors).toHaveLength(1);
    expect(interiors[0]!.format).toBe('pdf');
    expect(interiors[0]!.trimSizeId).toBe('6x9');
    expect(interiors[0]!.fileSizeBytes).toBeGreaterThan(1000);
    expect(interiors[0]!.storageKey).toBe(`interiors/${user._id.toString()}/${project._id.toString()}/batch-1.pdf`);

    const updatedProject = await ProjectModel.findById(project._id);
    expect(updatedProject!.workflowStatus.get('INTERIOR')).toBe('completed');
  });

  it('generates a docx and an epub for the same content without error', async () => {
    const { user, project } = await seedBookWithGeneratedContent();

    await runInteriorGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      format: 'docx',
      trimSizeId: '6x9',
      batchId: 'batch-docx',
    });
    await runInteriorGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      format: 'epub',
      trimSizeId: '6x9',
      batchId: 'batch-epub',
    });

    const interiors = await InteriorModel.find({ projectId: project._id }).sort({ createdAt: 1 });
    expect(interiors.map((i) => i.format)).toEqual(['docx', 'epub']);
  });

  it('keeps a prior successful interior when regenerating (append-only, not overwritten)', async () => {
    const { user, project } = await seedBookWithGeneratedContent();

    await runInteriorGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      format: 'pdf',
      trimSizeId: '6x9',
      batchId: 'batch-1',
    });
    await runInteriorGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      format: 'pdf',
      trimSizeId: '6x9',
      batchId: 'batch-2',
    });

    const interiors = await InteriorModel.find({ projectId: project._id });
    expect(interiors).toHaveLength(2);
  });
});
