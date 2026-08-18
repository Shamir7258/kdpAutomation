import { randomUUID } from 'node:crypto';
import type { GenerateInteriorInput, InteriorDto, JobDto } from '@kdp/shared';
import { generateInterior, type BookManuscript } from '@kdp/document-engine';
import { AppError } from '../../common/errors/app-error.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { metadataService } from '../metadata/metadata.service.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';
import { getInteriorGenerationQueue, type InteriorGenerationJobData } from '../../queue/queues.js';
import { QUEUE_NAMES } from '../../queue/queue-names.js';
import { jobService } from '../jobs/job.service.js';
import { getStorageProvider } from '../storage/storage-provider.instance.js';
import { InteriorModel, type InteriorDocument } from './interior.model.js';

function toDto(doc: InteriorDocument): InteriorDto {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    batchId: doc.batchId,
    format: doc.format as InteriorDto['format'],
    trimSizeId: doc.trimSizeId,
    url: doc.url,
    fileSizeBytes: doc.fileSizeBytes,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function buildManuscript(userId: string, projectId: string): Promise<BookManuscript> {
  const spec = await bookSpecificationService.getByProject(userId, projectId);
  const metadata = await metadataService.getByProject(userId, projectId).catch(() => undefined);

  const chapters = await ChapterModel.find({ projectId, userId }).sort({ order: 1 });
  const sections = await SectionModel.find({ projectId, userId }).sort({ order: 1 });

  // All versions for the project in one query, then pick each section's *current* one client-side
  // — cheaper than N findOne() round trips and avoids a cross-field $expr Mongo can't do simply.
  const allVersions = await ContentVersionModel.find({ projectId, userId }, { sectionId: 1, versionNumber: 1, content: 1 });
  const contentBySectionId = new Map<string, string>();
  for (const section of sections) {
    if (section.currentVersion === 0) continue;
    const version = allVersions.find(
      (v) => v.sectionId.toString() === section._id.toString() && v.versionNumber === section.currentVersion,
    );
    if (version) contentBySectionId.set(section._id.toString(), version.content);
  }

  return {
    title: metadata?.title || spec.workingTitle,
    subtitle: metadata?.subtitle || spec.subtitle || undefined,
    authorName: metadata?.authorName || undefined,
    chapters: chapters.map((chapter) => ({
      title: chapter.title,
      sections: sections
        .filter((s) => s.chapterId.toString() === chapter._id.toString())
        .map((section) => ({
          title: section.title,
          content: contentBySectionId.get(section._id.toString()) ?? '',
        })),
    })),
  };
}

export const interiorService = {
  async generate(userId: string, projectId: string, input: GenerateInteriorInput): Promise<JobDto> {
    await projectService.getById(userId, projectId); // ownership check

    const chapters = await ChapterModel.find({ projectId, userId }, { _id: 1 });
    if (chapters.length === 0) {
      throw AppError.validation('Generate an outline before generating the interior.');
    }
    const sections = await SectionModel.find({ projectId, userId }, { currentVersion: 1 });
    if (!sections.some((s) => s.currentVersion > 0)) {
      throw AppError.validation('Generate content before generating the interior.');
    }

    let trimSizeId = input.trimSizeId;
    if (!trimSizeId) {
      const spec = await bookSpecificationService.getByProject(userId, projectId).catch(() => undefined);
      trimSizeId = (spec?.trimSizeId as GenerateInteriorInput['trimSizeId']) ?? '6x9';
    }

    const batchId = randomUUID();
    const data: InteriorGenerationJobData = { userId, projectId, format: input.format, trimSizeId, batchId };
    // Create the Job doc *before* enqueueing — see the comment in content.service.ts's
    // enqueueOne for why (a fast worker can otherwise finish before the doc it's looking for
    // even exists, leaving it stuck "pending" forever — interior/cover rendering is fast enough
    // with the mock providers that this raced reliably until fixed).
    const bullJobId = randomUUID();
    const jobDoc = await jobService.createPending({
      queueName: QUEUE_NAMES.DOCUMENT_GENERATION,
      bullJobId,
      batchId,
      projectId,
      userId,
    });
    await getInteriorGenerationQueue().add('generate-interior', data, { jobId: bullJobId });

    return jobService.toDto(jobDoc);
  },

  async list(userId: string, projectId: string): Promise<InteriorDto[]> {
    await projectService.getById(userId, projectId); // ownership check
    const docs = await InteriorModel.find({ projectId, userId }).sort({ createdAt: -1 });
    return docs.map(toDto);
  },
};

/** The actual render+store work, extracted so it's unit-testable without a running BullMQ worker —
 *  mirrors runContentGeneration / runEditingPipeline. */
export async function runInteriorGeneration(data: InteriorGenerationJobData): Promise<void> {
  const { userId, projectId, format, trimSizeId, batchId } = data;
  const manuscript = await buildManuscript(userId, projectId);

  const result = await generateInterior(format, manuscript, { trimSizeId, includeTableOfContents: true });

  const storageKey = `interiors/${userId}/${projectId}/${batchId}.${result.fileExtension}`;
  const stored = await getStorageProvider().save(storageKey, result.data, result.contentType);

  await InteriorModel.create({
    projectId,
    userId,
    batchId,
    format,
    trimSizeId,
    storageKey: stored.key,
    url: stored.url,
    fileSizeBytes: stored.sizeBytes,
  });

  const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
  if (projectDoc) {
    projectDoc.workflowStatus.set('INTERIOR', 'completed');
    await projectDoc.save();
  }
}
