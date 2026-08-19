import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { MockAIProvider, MockImageProvider } from '@kdp/ai';
import { LocalStorageProvider } from '@kdp/storage';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { setImageProviderForTesting } from '../ai/image-provider.instance.js';
import { setStorageProviderForTesting } from '../storage/storage-provider.instance.js';
import { UserModel } from '../auth/user.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { BookSpecificationModel } from '../book-specifications/book-specification.model.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';
import { MetadataModel } from '../metadata/metadata.model.js';
import { runInteriorGeneration } from '../interior/interior.service.js';
import { runCoverGeneration } from '../cover/cover.service.js';
import { runExportGeneration } from './export.service.js';
import { ExportModel } from './export.model.js';

let storageRoot: string;

beforeAll(async () => {
  await startTestDb();
  await promptTemplateService.seedDefaults();
  setAIProviderForTesting(new MockAIProvider());
  setImageProviderForTesting(new MockImageProvider());
});
beforeEach(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'kdp-export-test-'));
  setStorageProviderForTesting(new LocalStorageProvider(storageRoot));
});
afterEach(async () => {
  await clearTestDb();
  await promptTemplateService.seedDefaults();
  await rm(storageRoot, { recursive: true, force: true });
});
afterAll(async () => {
  setAIProviderForTesting(undefined);
  setImageProviderForTesting(undefined);
  setStorageProviderForTesting(undefined);
  await stopTestDb();
});

async function seedProjectWithInteriorAndCover() {
  const user = await UserModel.create({ email: 'export-gen@example.com', passwordHash: 'x', name: 'Gen', role: 'user' });
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
  await MetadataModel.create({
    projectId: project._id,
    userId: user._id,
    title: 'Deep Work for Remote Workers',
    subtitle: 'Focus without an office',
    seriesName: '',
    description: 'A practical guide to staying focused while working from anywhere.',
    keywords: ['remote work', 'productivity', 'focus'],
    categories: ['Business & Money > Skills'],
    authorName: 'Jane Publisher',
    primaryMarketplace: 'amazon.com',
    aiSuggestions: { titles: [], subtitles: [], description: '', keywords: [], categories: [] },
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
    content: '# Why Focus Matters\n\nA short paragraph.',
    source: 'ai_generated',
  });

  await runInteriorGeneration({
    userId: user._id.toString(),
    projectId: project._id.toString(),
    format: 'pdf',
    trimSizeId: '6x9',
    batchId: 'interior-batch-1',
  });
  await runCoverGeneration({
    userId: user._id.toString(),
    projectId: project._id.toString(),
    paperType: 'white',
    batchId: 'cover-batch-1',
  });

  return { user, project };
}

describe('runExportGeneration (unit — no queue/Redis)', () => {
  it('bundles the interior, cover, and metadata into a valid ZIP and records an Export document', async () => {
    const { user, project } = await seedProjectWithInteriorAndCover();

    await runExportGeneration({ userId: user._id.toString(), projectId: project._id.toString(), batchId: 'export-batch-1' });

    const exports = await ExportModel.find({ projectId: project._id });
    expect(exports).toHaveLength(1);
    expect(exports[0]!.includedFiles).toEqual(
      expect.arrayContaining(['interior.pdf', 'cover-ebook.png', 'cover-wrap-print.pdf', 'metadata.txt', 'README.txt']),
    );
    expect(exports[0]!.fileSizeBytes).toBeGreaterThan(1000);

    const zipBytes = await readFromStorageRoot(exports[0]!.storageKey);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).sort()).toEqual(
      ['README.txt', 'cover-ebook.png', 'cover-wrap-print.pdf', 'interior.pdf', 'metadata.txt'].sort(),
    );
    const metadataText = await zip.file('metadata.txt')!.async('string');
    expect(metadataText).toContain('Deep Work for Remote Workers');
    expect(metadataText).toContain('Jane Publisher');

    const updatedProject = await ProjectModel.findById(project._id);
    expect(updatedProject!.workflowStatus.get('EXPORT')).toBe('completed');
  });

  it('keeps a prior successful export when regenerating (append-only, not overwritten)', async () => {
    const { user, project } = await seedProjectWithInteriorAndCover();

    await runExportGeneration({ userId: user._id.toString(), projectId: project._id.toString(), batchId: 'export-batch-1' });
    await runExportGeneration({ userId: user._id.toString(), projectId: project._id.toString(), batchId: 'export-batch-2' });

    const exports = await ExportModel.find({ projectId: project._id });
    expect(exports).toHaveLength(2);
  });
});

async function readFromStorageRoot(storageKey: string): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  return readFile(join(storageRoot, storageKey));
}
