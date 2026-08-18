import { Worker, type Job } from 'bullmq';
import { loadConfig } from '@kdp/config';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES } from '../queue-names.js';
import type { ContentGenerationJobData } from '../queues.js';
import { runContentGeneration } from '../../modules/content/content.service.js';
import { jobService } from '../../modules/jobs/job.service.js';
import { JobModel } from '../../modules/jobs/job.model.js';
import { logger } from '../../common/logger/logger.js';

let worker: Worker<ContentGenerationJobData> | undefined;

async function process(job: Job<ContentGenerationJobData>): Promise<void> {
  const jobDoc = await JobModel.findOne({ bullJobId: job.id });
  if (jobDoc) await jobService.markRunning(jobDoc._id.toString());

  try {
    await runContentGeneration(job.data);
    if (jobDoc) await jobService.markCompleted(jobDoc._id.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobDoc) await jobService.markFailed(jobDoc._id.toString(), message, job.attemptsMade + 1);
    throw err; // rethrow so BullMQ's retry/backoff (see queues.ts defaultJobOptions) still applies
  }
}

/** Runs in-process alongside the HTTP server (see server.ts) — no separate worker container in this phase; see ARCHITECTURE.md §5. */
export function startContentGenerationWorker(): Worker<ContentGenerationJobData> {
  if (worker) return worker;
  const config = loadConfig();

  worker = new Worker<ContentGenerationJobData>(QUEUE_NAMES.CONTENT_GENERATION, process, {
    connection: getRedisConnection(),
    concurrency: config.JOB_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, projectId: job?.data.projectId, err }, 'content generation job failed');
  });

  return worker;
}

export async function stopContentGenerationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
