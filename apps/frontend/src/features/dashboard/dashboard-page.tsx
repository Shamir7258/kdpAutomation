import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { DashboardStatsDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { STATUS_BADGE_VARIANT } from '@/features/projects/status-badge';

const STAT_CARDS: Array<{ key: keyof DashboardStatsDto; label: string }> = [
  { key: 'totalProjects', label: 'Total projects' },
  { key: 'draftBooks', label: 'Draft books' },
  { key: 'booksInProgress', label: 'In progress' },
  { key: 'completedBooks', label: 'Completed' },
  { key: 'failedJobs', label: 'Failed jobs' },
];

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get<DashboardStatsDto>('/dashboard/stats'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">An overview of your KDP catalog.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label }) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-semibold">{data?.[key] as number}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI usage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-5 w-40" />
            ) : (
              <p>
                ${data?.aiUsage.totalCostUsd.toFixed(2)} spent across {data?.aiUsage.totalCalls} calls
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage usage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="h-5 w-40" />
            ) : (
              <p>{((data?.storageUsage.totalBytes ?? 0) / 1024 / 1024).toFixed(1)} MB used</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && data?.recentProjects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No projects yet.{' '}
                <Link to="/projects" className="text-primary hover:underline">
                  Create your first one
                </Link>
                .
              </p>
            )}
            {data?.recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-md border px-4 py-2.5 text-sm hover:bg-accent"
              >
                <span className="font-medium">{project.name}</span>
                <Badge variant={STATUS_BADGE_VARIANT[project.status] ?? 'secondary'}>{project.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {!isLoading && data?.recentJobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No background jobs yet.</p>
            )}
            {data?.recentJobs.map((job) => (
              <Link
                key={job.id}
                to={`/projects/${job.projectId}`}
                className="flex items-center justify-between rounded-md border px-4 py-2.5 text-sm hover:bg-accent"
              >
                <span className="text-muted-foreground">{job.queueName}</span>
                <Badge variant={JOB_BADGE_VARIANT[job.status] ?? 'secondary'}>{job.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const JOB_BADGE_VARIANT: Record<string, 'secondary' | 'success' | 'destructive' | 'warning'> = {
  pending: 'secondary',
  running: 'warning',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
};
