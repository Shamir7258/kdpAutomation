import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import type { ExportDto, JobDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { metadataService } from '../metadata/metadata.service.js';
import { InteriorModel, type InteriorDocument } from '../interior/interior.model.js';
import { CoverModel, type CoverDocument } from '../cover/cover.model.js';
import { getExportGenerationQueue, type ExportGenerationJobData } from '../../queue/queues.js';
import { QUEUE_NAMES } from '../../queue/queue-names.js';
import { jobService } from '../jobs/job.service.js';
import { getStorageProvider } from '../storage/storage-provider.instance.js';
import { ExportModel, type ExportDocument } from './export.model.js';

function toDto(doc: ExportDocument): ExportDto {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    batchId: doc.batchId,
    includedFiles: doc.includedFiles,
    url: doc.url,
    fileSizeBytes: doc.fileSizeBytes,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function latestInterior(userId: string, projectId: string): Promise<InteriorDocument | null> {
  return InteriorModel.findOne({ projectId, userId }).sort({ createdAt: -1 });
}

async function latestCover(userId: string, projectId: string): Promise<CoverDocument | null> {
  return CoverModel.findOne({ projectId, userId }).sort({ createdAt: -1 });
}

function buildMetadataText(spec: { workingTitle: string }, metadata: Awaited<ReturnType<typeof metadataService.getByProject>> | undefined): string {
  if (!metadata) {
    return `Title: ${spec.workingTitle}\n\nNo metadata has been generated yet — visit the Metadata panel before publishing.\n`;
  }
  const lines = [
    `Title: ${metadata.title}`,
    metadata.subtitle ? `Subtitle: ${metadata.subtitle}` : null,
    metadata.seriesName ? `Series: ${metadata.seriesName}${metadata.seriesNumber ? ` #${metadata.seriesNumber}` : ''}` : null,
    `Author: ${metadata.authorName || '(not set)'}`,
    '',
    'Description:',
    metadata.description,
    '',
    'Keywords:',
    ...(metadata.keywords.length > 0 ? metadata.keywords.map((k, i) => `  ${i + 1}. ${k}`) : ['  (none set)']),
    '',
    'Categories:',
    ...(metadata.categories.length > 0 ? metadata.categories.map((c) => `  - ${c}`) : ['  (none set)']),
    '',
    `Primary marketplace: ${metadata.primaryMarketplace}`,
    metadata.pricing ? `Suggested list price: ${metadata.pricing.currency} ${metadata.pricing.listPrice}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n') + '\n';
}

const README_TEXT = `KDP Automation — Export Package
================================

This ZIP bundles the files this platform generated for your book so you
can complete your KDP submission by hand. It does NOT upload or submit
anything to Amazon automatically — this platform never accesses your
Amazon account, and there is no official KDP publishing API to automate
against. You still need to log into kdp.amazon.com yourself and complete
each step below.

Suggested steps:
  1. Log into KDP and create (or open) your title.
  2. Details — paste the title/subtitle/series/description/keywords/
     categories from metadata.txt into KDP's form fields.
  3. Manuscript — upload interior.* as your manuscript file.
  4. Cover:
       - Paperback: upload cover-wrap-print.pdf as your print cover.
       - Kindle eBook: upload cover-ebook.png as your eBook cover.
  5. Use KDP's own previewer to check the result before publishing.
  6. Set your pricing and territories, then publish when you're ready.

This package is a convenience bundle, not a guarantee of KDP approval —
always do a final manual review. See the Validation panel in the app for
an automated preflight checklist.
`;

export const exportService = {
  async generate(userId: string, projectId: string): Promise<JobDto> {
    await projectService.getById(userId, projectId); // ownership check

    const interior = await latestInterior(userId, projectId);
    if (!interior) {
      throw AppError.validation('Generate an interior before creating an export package.');
    }
    const cover = await latestCover(userId, projectId);
    if (!cover) {
      throw AppError.validation('Generate a cover before creating an export package.');
    }

    const batchId = randomUUID();
    const data: ExportGenerationJobData = { userId, projectId, batchId };
    const bullJobId = randomUUID();
    const jobDoc = await jobService.createPending({
      queueName: QUEUE_NAMES.EXPORT,
      bullJobId,
      batchId,
      projectId,
      userId,
    });
    await getExportGenerationQueue().add('generate-export', data, { jobId: bullJobId });

    return jobService.toDto(jobDoc);
  },

  async list(userId: string, projectId: string): Promise<ExportDto[]> {
    await projectService.getById(userId, projectId); // ownership check
    const docs = await ExportModel.find({ projectId, userId }).sort({ createdAt: -1 });
    return docs.map(toDto);
  },
};

/** The actual bundling work, extracted so it's unit-testable without a running BullMQ worker —
 *  mirrors runInteriorGeneration / runCoverGeneration. */
export async function runExportGeneration(data: ExportGenerationJobData): Promise<void> {
  const { userId, projectId, batchId } = data;

  const interior = await latestInterior(userId, projectId);
  const cover = await latestCover(userId, projectId);
  if (!interior || !cover) {
    throw new Error('Interior or cover no longer exists for this project.');
  }

  const spec = await bookSpecificationService.getByProject(userId, projectId);
  const metadata = await metadataService.getByProject(userId, projectId).catch(() => undefined);
  const storage = getStorageProvider();

  const [interiorBytes, ebookCoverBytes, wrapCoverBytes] = await Promise.all([
    storage.read(interior.storageKey),
    storage.read(cover.ebookCoverStorageKey),
    storage.read(cover.wrapCoverPdfStorageKey),
  ]);

  const zip = new JSZip();
  const interiorFilename = `interior.${interior.format}`;
  zip.file(interiorFilename, interiorBytes);
  zip.file('cover-ebook.png', ebookCoverBytes);
  zip.file('cover-wrap-print.pdf', wrapCoverBytes);
  zip.file('metadata.txt', buildMetadataText(spec, metadata));
  zip.file('README.txt', README_TEXT);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const includedFiles = [interiorFilename, 'cover-ebook.png', 'cover-wrap-print.pdf', 'metadata.txt', 'README.txt'];

  const storageKey = `exports/${userId}/${projectId}/${batchId}.zip`;
  const stored = await storage.save(storageKey, zipBuffer, 'application/zip');

  await ExportModel.create({
    projectId,
    userId,
    batchId,
    includedFiles,
    storageKey: stored.key,
    url: stored.url,
    fileSizeBytes: stored.sizeBytes,
  });

  const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
  if (projectDoc) {
    projectDoc.workflowStatus.set('EXPORT', 'completed');
    await projectDoc.save();
  }
}
