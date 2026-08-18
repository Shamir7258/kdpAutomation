import type { DashboardStatsDto } from '@kdp/shared';
import { ProjectModel } from '../projects/project.model.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { jobService } from '../jobs/job.service.js';

const IN_PROGRESS_STATUSES = ['RESEARCHING', 'PLANNING', 'GENERATING', 'EDITING', 'DESIGNING', 'VALIDATING'];

export const dashboardService = {
  async getStats(userId: string): Promise<DashboardStatsDto> {
    const baseFilter = { userId, deletedAt: null, archivedAt: null };

    const [totalProjects, draftBooks, booksInProgress, completedBooks, recentProjects, aiUsage, failedJobs, recentJobs] =
      await Promise.all([
        ProjectModel.countDocuments(baseFilter),
        ProjectModel.countDocuments({ ...baseFilter, status: 'DRAFT' }),
        ProjectModel.countDocuments({ ...baseFilter, status: { $in: IN_PROGRESS_STATUSES } }),
        ProjectModel.countDocuments({ ...baseFilter, status: 'READY' }),
        ProjectModel.find(baseFilter).sort({ updatedAt: -1 }).limit(5),
        aiUsageService.getSummary(userId),
        jobService.countFailedForUser(userId),
        jobService.recentForUser(userId, 5),
      ]);

    return {
      totalProjects,
      draftBooks,
      booksInProgress,
      completedBooks,
      failedJobs,
      recentProjects: recentProjects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        status: p.status,
        updatedAt: p.updatedAt.toISOString(),
      })),
      recentJobs,
      aiUsage,
      storageUsage: { totalBytes: 0 },
    };
  },
};
