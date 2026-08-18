import type { JobDto } from './job.schemas.js';

export interface DashboardStatsDto {
  totalProjects: number;
  draftBooks: number;
  booksInProgress: number;
  completedBooks: number;
  failedJobs: number;
  recentProjects: Array<{ id: string; name: string; status: string; updatedAt: string }>;
  recentJobs: JobDto[];
  aiUsage: { totalCostUsd: number; totalCalls: number };
  storageUsage: { totalBytes: number };
}
