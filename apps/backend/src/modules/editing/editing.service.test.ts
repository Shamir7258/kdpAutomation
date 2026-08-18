import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MockAIProvider } from '@kdp/ai';
import { EDIT_PASS_TYPES } from '@kdp/shared';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { UserModel } from '../auth/user.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';
import { EditPassModel } from './edit-pass.model.js';
import { runEditingPipeline } from './editing.service.js';

beforeAll(async () => {
  await startTestDb();
  await promptTemplateService.seedDefaults();
  setAIProviderForTesting(new MockAIProvider());
});
afterEach(async () => {
  await clearTestDb();
  await promptTemplateService.seedDefaults();
});
afterAll(async () => {
  setAIProviderForTesting(undefined);
  await stopTestDb();
});

async function seedSectionWithContent() {
  const user = await UserModel.create({ email: 'editor@example.com', passwordHash: 'x', name: 'Editor', role: 'user' });
  const project = await ProjectModel.create({
    userId: user._id,
    name: 'Fitness Guide',
    bookType: 'how_to_guide',
    niche: 'home workouts',
    status: 'GENERATING',
  });
  const chapter = await ChapterModel.create({ projectId: project._id, userId: user._id, title: 'Getting Started', summary: 'Intro', order: 0 });
  const section = await SectionModel.create({
    chapterId: chapter._id,
    projectId: project._id,
    userId: user._id,
    title: 'Why home workouts',
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
    content: 'Home workouts save time and money for busy parents.',
    source: 'ai_generated',
  });
  return { user, project, chapter, section };
}

describe('runEditingPipeline (unit — no queue/Redis)', () => {
  it('runs all 7 passes and stores each one separately under the same batchId', async () => {
    const { user, project, chapter, section } = await seedSectionWithContent();

    await runEditingPipeline({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      chapterId: chapter._id.toString(),
      sectionId: section._id.toString(),
      batchId: 'batch-1',
    });

    const passes = await EditPassModel.find({ sectionId: section._id });
    expect(passes).toHaveLength(EDIT_PASS_TYPES.length);
    expect(new Set(passes.map((p) => p.passType))).toEqual(new Set(EDIT_PASS_TYPES));
    expect(passes.every((p) => p.batchId === 'batch-1')).toBe(true);
    expect(passes.every((p) => p.summary.length > 0)).toBe(true);
  });

  it('does not delete or merge passes from a prior run — a second run adds a new batch', async () => {
    const { user, project, chapter, section } = await seedSectionWithContent();
    const data = {
      userId: user._id.toString(),
      projectId: project._id.toString(),
      chapterId: chapter._id.toString(),
      sectionId: section._id.toString(),
    };

    await runEditingPipeline({ ...data, batchId: 'batch-1' });
    await runEditingPipeline({ ...data, batchId: 'batch-2' });

    const passes = await EditPassModel.find({ sectionId: section._id });
    expect(passes).toHaveLength(EDIT_PASS_TYPES.length * 2);
  });
});
