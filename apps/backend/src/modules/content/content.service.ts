import { randomUUID } from 'node:crypto';
import type { ContentVersionDto, JobDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { ChapterModel, type ChapterDocument } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { contentVersionService } from '../content-versions/content-version.service.js';
import { getContentGenerationQueue, type ContentGenerationJobData } from '../../queue/queues.js';
import { QUEUE_NAMES } from '../../queue/queue-names.js';
import { jobService } from '../jobs/job.service.js';

async function findOwnedChapter(userId: string, projectId: string, chapterId: string): Promise<ChapterDocument> {
  const chapter = await ChapterModel.findOne({ _id: chapterId, projectId, userId });
  if (!chapter) {
    throw AppError.notFound('Chapter not found.');
  }
  return chapter;
}

async function enqueueOne(
  userId: string,
  projectId: string,
  chapterId: string,
  sectionId: string,
  batchId: string,
): Promise<JobDto> {
  const data: ContentGenerationJobData = { userId, projectId, chapterId, sectionId, batchId };
  // The Job doc must exist in Mongo *before* the BullMQ job can possibly be picked up, or a fast
  // worker can finish (and try to mark the job completed) before the doc it's looking for has
  // even been created — leaving it stuck "pending" forever. Pre-generating the id and creating
  // the doc first, then passing that same id as BullMQ's jobId, makes the ordering race-proof.
  const bullJobId = randomUUID();
  const jobDoc = await jobService.createPending({
    queueName: QUEUE_NAMES.CONTENT_GENERATION,
    bullJobId,
    batchId,
    projectId,
    userId,
    chapterId,
    sectionId,
  });
  await getContentGenerationQueue().add('generate-section', data, { jobId: bullJobId });
  return jobService.toDto(jobDoc);
}

export const contentService = {
  /** Enqueues one section, regardless of whether it already has content — the explicit "regenerate this section" action. */
  async generateSection(userId: string, projectId: string, chapterId: string, sectionId: string): Promise<JobDto> {
    await findOwnedChapter(userId, projectId, chapterId);
    const section = await SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId });
    if (!section) {
      throw AppError.notFound('Section not found.');
    }
    return enqueueOne(userId, projectId, chapterId, sectionId, randomUUID());
  },

  /** Enqueues every section in the chapter that has no content yet (§44 — never silently regenerate a completed section). */
  async generateChapter(userId: string, projectId: string, chapterId: string): Promise<JobDto[]> {
    await findOwnedChapter(userId, projectId, chapterId);
    const sections = await SectionModel.find({ chapterId, projectId, userId, currentVersion: 0 }).sort({ order: 1 });
    if (sections.length === 0) return [];
    const batchId = randomUUID();
    return Promise.all(sections.map((s) => enqueueOne(userId, projectId, chapterId, s._id.toString(), batchId)));
  },

  /** Enqueues every not-yet-generated section across the whole book — resumable: re-running after a partial failure only re-enqueues what's still missing. */
  async generateBook(userId: string, projectId: string): Promise<JobDto[]> {
    await projectService.getById(userId, projectId);
    const sections = await SectionModel.find({ projectId, userId, currentVersion: 0 }).sort({ order: 1 });
    if (sections.length === 0) return [];
    const batchId = randomUUID();
    return Promise.all(
      sections.map((s) => enqueueOne(userId, projectId, s.chapterId.toString(), s._id.toString(), batchId)),
    );
  },

  async listJobs(userId: string, projectId: string): Promise<JobDto[]> {
    await projectService.getById(userId, projectId);
    return jobService.listForProject(userId, projectId);
  },

  /** The editor's "Save" action (§34) — appends a new version, never overwrites (§14). */
  async saveManualEdit(
    userId: string,
    projectId: string,
    chapterId: string,
    sectionId: string,
    content: string,
  ): Promise<ContentVersionDto> {
    await findOwnedChapter(userId, projectId, chapterId);
    const section = await SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId });
    if (!section) {
      throw AppError.notFound('Section not found.');
    }
    return contentVersionService.createVersion({ userId, projectId, chapterId, sectionId, content, source: 'manual_edit' });
  },
};

/**
 * The actual generation work, extracted so it's unit-testable without a
 * running Redis/BullMQ worker (see content.service.test.ts) — the BullMQ
 * processor (queue/workers/content-generation.worker.ts) is a thin wrapper
 * that calls this and updates the Job record around it.
 */
export async function runContentGeneration(data: ContentGenerationJobData): Promise<void> {
  const { userId, projectId, chapterId, sectionId } = data;

  const [project, spec, chapter, section] = await Promise.all([
    projectService.getById(userId, projectId),
    bookSpecificationService.getByProject(userId, projectId),
    ChapterModel.findOne({ _id: chapterId, projectId, userId }),
    SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId }),
  ]);
  if (!chapter || !section) {
    throw AppError.notFound('Chapter or section no longer exists.');
  }

  const context = [
    `Book: ${spec.workingTitle} — ${spec.subtitle}`,
    `Niche: ${project.niche}`,
    `Audience: ${spec.audience}`,
    `Tone: ${spec.tone}`,
    `Reading level: ${spec.readingLevel}`,
    `Language: ${project.language}`,
    `Chapter: ${chapter.title} — ${chapter.summary}`,
    `Section to write: ${section.title} — ${section.summary}`,
  ].join('\n');

  const provider = getAIProvider();
  const result = await provider.generateBookContent(context);
  await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'section_content_generation', result });

  await contentVersionService.createVersion({
    userId,
    projectId,
    chapterId,
    sectionId,
    content: result.text,
    source: 'ai_generated',
  });

  const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
  if (projectDoc) {
    if (projectDoc.status === 'PLANNING') projectDoc.status = 'GENERATING';
    const remaining = await SectionModel.countDocuments({ projectId, userId, currentVersion: 0 });
    if (remaining === 0) projectDoc.workflowStatus.set('CONTENT', 'completed');
    else projectDoc.workflowStatus.set('CONTENT', 'running');
    await projectDoc.save();
  }
}
