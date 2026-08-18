import { Worker, type Job } from 'bullmq';
import { loadConfig } from '@kdp/config';
import { getRedisConnection } from '../redis.js';
import { QUEUE_NAMES } from '../queue-names.js';
import type { EditingPipelineJobData } from '../queues.js';
import { runEditingPipeline } from '../../modules/editing/editing.service.js';
import { jobService } from '../../modules/jobs/job.service.js';
import { JobModel } from '../../modules/jobs/job.model.js';
import { logger } from '../../common/logger/logger.js';

let worker: Worker<EditingPipelineJobData> | undefined;

async function process(job: Job<EditingPipelineJobData>): Promise<void> {
  const jobDoc = await JobModel.findOne({ bullJobId: job.id });
  if (jobDoc) await jobService.markRunning(jobDoc._id.toString());

  try {
    await runEditingPipeline(job.data);
    if (jobDoc) await jobService.markCompleted(jobDoc._id.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jobDoc) await jobService.markFailed(jobDoc._id.toString(), message, job.attemptsMade + 1);
    throw err;
  }
}

/** Runs in-process alongside the HTTP server, same as the content-generation worker — see ARCHITECTURE.md §5. */
export function startEditingWorker(): Worker<EditingPipelineJobData> {
  if (worker) return worker;
  const config = loadConfig();

  worker = new Worker<EditingPipelineJobData>(QUEUE_NAMES.EDITING, process, {
    connection: getRedisConnection(),
    concurrency: config.JOB_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, projectId: job?.data.projectId, err }, 'editing pipeline job failed');
  });

  return worker;
}

export async function stopEditingWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
