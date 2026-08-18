import { Worker, type Job } from 'bullmq';
import { loadConfig } from '@kdp/config';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES } from '../queue-names.js';
import type { InteriorGenerationJobData } from '../queues.js';
import { runInteriorGeneration } from '../../modules/interior/interior.service.js';
import { jobService } from '../../modules/jobs/job.service.js';
import { JobModel } from '../../modules/jobs/job.model.js';
import { logger } from '../../common/logger/logger.js';

let worker: Worker<InteriorGenerationJobData> | undefined;

async function process(job: Job<InteriorGenerationJobData>): Promise<void> {
  const jobDoc = await JobModel.findOne({ bullJobId: job.id });
  if (jobDoc) await jobService.markRunning(jobDoc._id.toString());

  try {
    await runInteriorGeneration(job.data);
    if (jobDoc) await jobService.markCompleted(jobDoc._id.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobDoc) await jobService.markFailed(jobDoc._id.toString(), message, job.attemptsMade + 1);
    throw err;
  }
}

/** Runs in-process alongside the HTTP server, same as the other workers — see ARCHITECTURE.md §5. */
export function startInteriorWorker(): Worker<InteriorGenerationJobData> {
  if (worker) return worker;
  const config = loadConfig();

  worker = new Worker<InteriorGenerationJobData>(QUEUE_NAMES.DOCUMENT_GENERATION, process, {
    connection: getRedisConnection(),
    concurrency: config.JOB_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, projectId: job?.data.projectId, err }, 'interior generation job failed');
  });

  return worker;
}

export async function stopInteriorWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
