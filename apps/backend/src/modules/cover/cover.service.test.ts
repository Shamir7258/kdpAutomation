import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MockAIProvider, MockImageProvider } from '@kdp/ai';
import { LocalStorageProvider } from '@kdp/storage';
import { calculateSpineWidthInches } from '@kdp/cover-engine';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { setImageProviderForTesting } from '../ai/image-provider.instance.js';
import { setStorageProviderForTesting } from '../storage/storage-provider.instance.js';
import { UserModel } from '../auth/user.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { BookSpecificationModel } from '../book-specifications/book-specification.model.js';
import { runCoverGeneration } from './cover.service.js';
import { CoverModel } from './cover.model.js';

let storageRoot: string;

beforeAll(async () => {
  await startTestDb();
  await promptTemplateService.seedDefaults();
  setAIProviderForTesting(new MockAIProvider());
  setImageProviderForTesting(new MockImageProvider());
});
beforeEach(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'kdp-cover-test-'));
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

async function seedBookWithSpecification() {
  const user = await UserModel.create({ email: 'cover-gen@example.com', passwordHash: 'x', name: 'Gen', role: 'user' });
  const project = await ProjectModel.create({
    userId: user._id,
    name: 'Deep Work for Remote Workers',
    bookType: 'how_to_guide',
    niche: 'remote work productivity',
    status: 'GENERATING',
  });
  const spec = await BookSpecificationModel.create({
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
  return { user, project, spec };
}

describe('runCoverGeneration (unit — no queue/Redis)', () => {
  it('generates a cover, stores it, records a Cover document, and marks the workflow stage completed', async () => {
    const { user, project, spec } = await seedBookWithSpecification();

    await runCoverGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      paperType: 'white',
      batchId: 'batch-1',
    });

    const covers = await CoverModel.find({ projectId: project._id });
    expect(covers).toHaveLength(1);
    const cover = covers[0]!;
    expect(cover.paperType).toBe('white');
    expect(cover.spineWidthIn).toBe(calculateSpineWidthInches(spec.estimatedPageCount, 'white'));
    expect(cover.ebookCoverStorageKey).toEqual(expect.any(String));
    expect(cover.ebookCoverStorageKey.length).toBeGreaterThan(0);
    expect(cover.ebookCoverUrl).toEqual(expect.any(String));
    expect(cover.ebookCoverUrl.length).toBeGreaterThan(0);
    expect(cover.wrapCoverPdfStorageKey).toEqual(expect.any(String));
    expect(cover.wrapCoverPdfStorageKey.length).toBeGreaterThan(0);
    expect(cover.wrapCoverPdfUrl).toEqual(expect.any(String));
    expect(cover.wrapCoverPdfUrl.length).toBeGreaterThan(0);

    const updatedProject = await ProjectModel.findById(project._id);
    expect(updatedProject!.workflowStatus.get('COVER')).toBe('completed');
  });

  it('keeps a prior successful cover when regenerating (append-only, not overwritten)', async () => {
    const { user, project } = await seedBookWithSpecification();

    await runCoverGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      paperType: 'white',
      batchId: 'batch-1',
    });
    await runCoverGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      paperType: 'white',
      batchId: 'batch-2',
    });

    const covers = await CoverModel.find({ projectId: project._id });
    expect(covers).toHaveLength(2);
  });
});
