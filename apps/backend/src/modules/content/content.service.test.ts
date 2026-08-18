import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MockAIProvider } from '@kdp/ai';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/mongo-test-utils.js';
import { promptTemplateService } from '../prompt-templates/prompt-template.service.js';
import { setAIProviderForTesting } from '../ai/ai-provider.instance.js';
import { UserModel } from '../auth/user.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { BookSpecificationModel } from '../book-specifications/book-specification.model.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';
import { runContentGeneration } from './content.service.js';

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

async function seedBookWithOneSection() {
  const user = await UserModel.create({ email: 'gen@example.com', passwordHash: 'x', name: 'Gen', role: 'user' });
  const project = await ProjectModel.create({
    userId: user._id,
    name: 'Fitness Guide',
    bookType: 'how_to_guide',
    niche: 'home workouts',
    status: 'PLANNING',
  });
  await BookSpecificationModel.create({
    projectId: project._id,
    userId: user._id,
    ideaId: user._id, // not referenced by runContentGeneration; any ObjectId satisfies the schema
    workingTitle: 'Home Workouts 101',
    subtitle: 'A beginner guide',
    audience: 'busy parents',
    tone: 'friendly',
    readingLevel: 'beginner',
    language: 'en',
    trimSizeId: '6x9',
    estimatedPageCount: 120,
    chapterCount: 3,
  });
  const chapter = await ChapterModel.create({ projectId: project._id, userId: user._id, title: 'Getting Started', summary: 'Intro', order: 0 });
  const section = await SectionModel.create({
    chapterId: chapter._id,
    projectId: project._id,
    userId: user._id,
    title: 'Why home workouts',
    summary: 'Motivation',
    order: 0,
  });
  return { user, project, chapter, section };
}

describe('runContentGeneration (unit — no queue/Redis)', () => {
  it('generates content, creates a ContentVersion, and advances the section/project state', async () => {
    const { user, project, chapter, section } = await seedBookWithOneSection();

    await runContentGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      chapterId: chapter._id.toString(),
      sectionId: section._id.toString(),
      batchId: 'batch-1',
    });

    const versions = await ContentVersionModel.find({ sectionId: section._id });
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.source).toBe('ai_generated');
    expect(versions[0]!.content.length).toBeGreaterThan(0);

    const updatedSection = await SectionModel.findById(section._id);
    expect(updatedSection!.currentVersion).toBe(1);

    const updatedProject = await ProjectModel.findById(project._id);
    expect(updatedProject!.status).toBe('GENERATING');
    expect(updatedProject!.workflowStatus.get('CONTENT')).toBe('completed');
  });

  it('appends a new version rather than overwriting on a second generation', async () => {
    const { user, project, chapter, section } = await seedBookWithOneSection();
    const jobData = {
      userId: user._id.toString(),
      projectId: project._id.toString(),
      chapterId: chapter._id.toString(),
      sectionId: section._id.toString(),
      batchId: 'batch-1',
    };

    await runContentGeneration(jobData);
    await runContentGeneration({ ...jobData, batchId: 'batch-2' });

    const versions = await ContentVersionModel.find({ sectionId: section._id }).sort({ versionNumber: 1 });
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);

    const updatedSection = await SectionModel.findById(section._id);
    expect(updatedSection!.currentVersion).toBe(2);
  });

  it('marks workflowStatus.CONTENT as "running" (not "completed") while other sections remain ungenerated', async () => {
    const { user, project, chapter, section } = await seedBookWithOneSection();
    // A second, not-yet-generated section in the same chapter.
    await SectionModel.create({
      chapterId: chapter._id,
      projectId: project._id,
      userId: user._id,
      title: 'Equipment basics',
      summary: 'What you need',
      order: 1,
    });

    await runContentGeneration({
      userId: user._id.toString(),
      projectId: project._id.toString(),
      chapterId: chapter._id.toString(),
      sectionId: section._id.toString(),
      batchId: 'batch-1',
    });

    const updatedProject = await ProjectModel.findById(project._id);
    expect(updatedProject!.workflowStatus.get('CONTENT')).toBe('running');
  });
});
