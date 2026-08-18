import { randomUUID } from 'node:crypto';
import type { GenerateCoverInput, CoverDto, JobDto } from '@kdp/shared';
import { generateCover } from '@kdp/cover-engine';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { metadataService } from '../metadata/metadata.service.js';
import { getCoverGenerationQueue, type CoverGenerationJobData } from '../../queue/queues.js';
import { QUEUE_NAMES } from '../../queue/queue-names.js';
import { jobService } from '../jobs/job.service.js';
import { getStorageProvider } from '../storage/storage-provider.instance.js';
import { getImageProvider } from '../ai/image-provider.instance.js';
import { CoverModel, type CoverDocument } from './cover.model.js';

function toDto(doc: CoverDocument): CoverDto {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    batchId: doc.batchId,
    paperType: doc.paperType as CoverDto['paperType'],
    pageCount: doc.pageCount,
    spineWidthIn: doc.spineWidthIn,
    ebookCoverUrl: doc.ebookCoverUrl,
    wrapCoverPdfUrl: doc.wrapCoverPdfUrl,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const coverService = {
  async generate(userId: string, projectId: string, input: GenerateCoverInput): Promise<JobDto> {
    await projectService.getById(userId, projectId); // ownership check

    // Requires a BookSpecification to exist first — getByProject throws AppError.notFound
    // itself when missing, which is fine to let propagate (mirrors buildManuscript in
    // interior.service.ts). Unlike interior generation, no outline/generated content required.
    await bookSpecificationService.getByProject(userId, projectId);

    const batchId = randomUUID();
    const data: CoverGenerationJobData = { userId, projectId, paperType: input.paperType, stylePrompt: input.stylePrompt, batchId };
    // Create the Job doc *before* enqueueing — see the comment in content.service.ts's
    // enqueueOne for why (a fast worker can otherwise finish before the doc it's looking for
    // even exists, leaving it stuck "pending" forever — cover rendering with the mock image
    // provider is fast enough that this raced reliably until fixed).
    const bullJobId = randomUUID();
    const jobDoc = await jobService.createPending({
      queueName: QUEUE_NAMES.COVER_GENERATION,
      bullJobId,
      batchId,
      projectId,
      userId,
    });
    await getCoverGenerationQueue().add('generate-cover', data, { jobId: bullJobId });

    return jobService.toDto(jobDoc);
  },

  async list(userId: string, projectId: string): Promise<CoverDto[]> {
    await projectService.getById(userId, projectId); // ownership check
    const docs = await CoverModel.find({ projectId, userId }).sort({ createdAt: -1 });
    return docs.map(toDto);
  },
};

/** The actual render+store work, extracted so it's unit-testable without a running BullMQ worker —
 *  mirrors runInteriorGeneration. */
export async function runCoverGeneration(data: CoverGenerationJobData): Promise<void> {
  const { userId, projectId, paperType, stylePrompt, batchId } = data;

  const spec = await bookSpecificationService.getByProject(userId, projectId);
  const metadata = await metadataService.getByProject(userId, projectId).catch(() => undefined);
  const project = await projectService.getById(userId, projectId);

  const title = metadata?.title || spec.workingTitle;
  const subtitle = metadata?.subtitle || spec.subtitle || undefined;
  const pageCount = spec.estimatedPageCount || 100;

  const prompt =
    `A professional, high-quality book cover illustration for a book titled "${title}"` +
    `${subtitle ? `: ${subtitle}` : ''}. Genre/niche: ${project.niche}. Tone: ${spec.tone}. ${stylePrompt ?? ''} ` +
    `Do not include any text, letters, words, or typography anywhere in the image — this is illustration/artwork only, all title text will be added separately.`;

  const image = await getImageProvider().generateImage(prompt, { size: '1024x1536' });

  const backCoverBlurb = metadata?.description ? metadata.description.slice(0, 500) : undefined;

  const result = await generateCover({
    title,
    subtitle,
    authorName: metadata?.authorName || undefined,
    trimSizeId: spec.trimSizeId,
    pageCount,
    paperType,
    frontImage: image.data,
    backCoverBlurb,
  });

  const ebookCoverKey = `covers/${userId}/${projectId}/${batchId}-ebook.png`;
  const storedEbookCover = await getStorageProvider().save(ebookCoverKey, result.ebookCover, result.ebookCoverContentType);

  const wrapCoverKey = `covers/${userId}/${projectId}/${batchId}-wrap.pdf`;
  const storedWrapCover = await getStorageProvider().save(wrapCoverKey, result.wrapCoverPdf, 'application/pdf');

  await CoverModel.create({
    projectId,
    userId,
    batchId,
    paperType,
    pageCount,
    spineWidthIn: result.spineWidthIn,
    ebookCoverStorageKey: storedEbookCover.key,
    ebookCoverUrl: storedEbookCover.url,
    wrapCoverPdfStorageKey: storedWrapCover.key,
    wrapCoverPdfUrl: storedWrapCover.url,
  });

  const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
  if (projectDoc) {
    projectDoc.workflowStatus.set('COVER', 'completed');
    await projectDoc.save();
  }
}
