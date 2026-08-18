import { Queue } from 'bullmq';
import { getRedisConnection } from './redis.js';
import { QUEUE_NAMES } from './queue-names.js';

let queue: Queue<ContentGenerationJobData> | undefined;

export interface ContentGenerationJobData {
  projectId: string;
  userId: string;
  chapterId: string;
  sectionId: string;
  /** Groups jobs enqueued by one "generate book" / "generate chapter" call so the frontend can show aggregate progress. */
  batchId: string;
}

/** Lazily constructed so it always binds to the current Redis connection (matters for tests, which may reconfigure REDIS_URL). */
export function getContentGenerationQueue(): Queue<ContentGenerationJobData> {
  if (!queue) {
    queue = new Queue<ContentGenerationJobData>(QUEUE_NAMES.CONTENT_GENERATION, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 days — Job (Mongo) is the durable record; this is just Redis housekeeping
        removeOnFail: { age: 60 * 60 * 24 * 30 },
      },
    });
  }
  return queue;
}

export async function closeQueues(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
}
