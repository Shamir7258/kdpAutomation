import type { JobDto } from '@kdp/shared';
import { JobModel, type JobDocument } from './job.model.js';

function toDto(job: JobDocument): JobDto {
  return {
    id: job._id.toString(),
    queueName: job.queueName,
    batchId: job.batchId,
    projectId: job.projectId.toString(),
    chapterId: job.chapterId ? job.chapterId.toString() : null,
    sectionId: job.sectionId ? job.sectionId.toString() : null,
    status: job.status as JobDto['status'],
    attempts: job.attempts,
    progress: job.progress,
    error: job.error ?? null,
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
  };
}

export const jobService = {
  toDto,

  async createPending(input: {
    queueName: string;
    bullJobId: string;
    batchId: string;
    projectId: string;
    userId: string;
    /** Omitted for project-level jobs that aren't scoped to one chapter/section (e.g. interior generation). */
    chapterId?: string;
    sectionId?: string;
  }): Promise<JobDocument> {
    return JobModel.create({ ...input, status: 'pending' });
  },

  async markRunning(jobId: string): Promise<void> {
    await JobModel.updateOne({ _id: jobId }, { status: 'running', startedAt: new Date() });
  },

  async markCompleted(jobId: string): Promise<void> {
    await JobModel.updateOne({ _id: jobId }, { status: 'completed', progress: 100, completedAt: new Date(), error: null });
  },

  async markFailed(jobId: string, error: string, attempts: number): Promise<void> {
    await JobModel.updateOne({ _id: jobId }, { status: 'failed', error, attempts, completedAt: new Date() });
  },

  async listForProject(userId: string, projectId: string): Promise<JobDto[]> {
    const jobs = await JobModel.find({ projectId, userId }).sort({ createdAt: -1 }).limit(200);
    return jobs.map(toDto);
  },

  async countFailedForUser(userId: string): Promise<number> {
    return JobModel.countDocuments({ userId, status: 'failed' });
  },

  async recentForUser(userId: string, limit: number): Promise<JobDto[]> {
    const jobs = await JobModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
    return jobs.map(toDto);
  },
};
