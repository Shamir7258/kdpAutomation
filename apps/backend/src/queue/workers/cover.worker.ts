import { Worker, type Job } from 'bullmq';
import { loadConfig } from '@kdp/config';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES } from '../queue-names.js';
import type { CoverGenerationJobData } from '../queues.js';
import { runCoverGeneration } from '../../modules/cover/cover.service.js';
import { jobService } from '../../modules/jobs/job.service.js';
import { JobModel } from '../../modules/jobs/job.model.js';
import { logger } from '../../common/logger/logger.js';

let worker: Worker<CoverGenerationJobData> | undefined;

async function process(job: Job<CoverGenerationJobData>): Promise<void> {
  const jobDoc = await JobModel.findOne({ bullJobId: job.id });
  if (jobDoc) await jobService.markRunning(jobDoc._id.toString());

  try {
    await runCoverGeneration(job.data);
    if (jobDoc) await jobService.markCompleted(jobDoc._id.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobDoc) await jobService.markFailed(jobDoc._id.toString(), message, job.attemptsMade + 1);
    throw err;
  }
}

/** Runs in-process alongside the HTTP server, same as the other workers — see ARCHITECTURE.md §5. */
export function startCoverWorker(): Worker<CoverGenerationJobData> {
  if (worker) return worker;
  const config = loadConfig();

  worker = new Worker<CoverGenerationJobData>(QUEUE_NAMES.COVER_GENERATION, process, {
    connection: getRedisConnection(),
    concurrency: config.JOB_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, projectId: job?.data.projectId, err }, 'cover generation job failed');
  });

  return worker;
}

export async function stopCoverWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
