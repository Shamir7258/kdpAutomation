export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface JobDto {
  id: string;
  queueName: string;
  batchId: string;
  projectId: string;
  chapterId: string | null;
  sectionId: string | null;
  status: JobStatus;
  attempts: number;
  progress: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
