import { Queue } from 'bullmq';
import { getRedisConnection } from './redis.js';
import { QUEUE_NAMES } from './queue-names.js';

export interface ContentGenerationJobData {
  projectId: string;
  userId: string;
  chapterId: string;
  sectionId: string;
  /** Groups jobs enqueued by one "generate book" / "generate chapter" call so the frontend can show aggregate progress. */
  batchId: string;
}

export interface EditingPipelineJobData {
  projectId: string;
  userId: string;
  chapterId: string;
  sectionId: string;
  batchId: string;
}

export interface InteriorGenerationJobData {
  projectId: string;
  userId: string;
  format: 'pdf' | 'epub' | 'docx';
  trimSizeId: string;
  batchId: string;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 days — Job (Mongo) is the durable record; this is just Redis housekeeping
  removeOnFail: { age: 60 * 60 * 24 * 30 },
};

let contentGenerationQueue: Queue<ContentGenerationJobData> | undefined;
let editingQueue: Queue<EditingPipelineJobData> | undefined;
let interiorGenerationQueue: Queue<InteriorGenerationJobData> | undefined;

/** Lazily constructed so it always binds to the current Redis connection (matters for tests, which may reconfigure REDIS_URL). */
export function getContentGenerationQueue(): Queue<ContentGenerationJobData> {
  if (!contentGenerationQueue) {
    contentGenerationQueue = new Queue<ContentGenerationJobData>(QUEUE_NAMES.CONTENT_GENERATION, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return contentGenerationQueue;
}

/** The editing pipeline (§15) runs as one job covering all passes sequentially — see queue/workers/editing.worker.ts. */
export function getEditingQueue(): Queue<EditingPipelineJobData> {
  if (!editingQueue) {
    editingQueue = new Queue<EditingPipelineJobData>(QUEUE_NAMES.EDITING, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return editingQueue;
}

/** Interior generation (PDF/EPUB/DOCX rendering) — genuinely long-running for a full book, so it
 *  goes through the same job queue pattern as content generation and the editing pipeline. */
export function getInteriorGenerationQueue(): Queue<InteriorGenerationJobData> {
  if (!interiorGenerationQueue) {
    interiorGenerationQueue = new Queue<InteriorGenerationJobData>(QUEUE_NAMES.DOCUMENT_GENERATION, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return interiorGenerationQueue;
}

export async function closeQueues(): Promise<void> {
  if (contentGenerationQueue) {
    await contentGenerationQueue.close();
    contentGenerationQueue = undefined;
  }
  if (editingQueue) {
    await editingQueue.close();
    editingQueue = undefined;
  }
  if (interiorGenerationQueue) {
    await interiorGenerationQueue.close();
    interiorGenerationQueue = undefined;
  }
}
