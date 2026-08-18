import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import type { EditPassDto, JobDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

const PASS_LABELS: Record<string, string> = {
  grammar: 'Grammar',
  clarity: 'Clarity',
  consistency: 'Consistency',
  structure: 'Structure',
  fact_checking: 'Fact Checking',
  ai_detection_risk: 'AI Detection Risk',
  final_review: 'Final Review',
};

const SEVERITY_VARIANT: Record<string, 'secondary' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
};

const ACTIVE_STATUSES = new Set(['pending', 'running']);

export function EditPassesPanel({ projectId, chapterId, sectionId }: { projectId: string; chapterId: string; sectionId: string }) {
  const queryClient = useQueryClient();
  const base = `/projects/${projectId}/chapters/${chapterId}/sections/${sectionId}/edit-passes`;

  const passesQuery = useQuery({
    queryKey: ['projects', projectId, 'edit-passes', sectionId],
    queryFn: () => api.get<EditPassDto[]>(base),
  });

  const jobsQuery = useQuery({
    queryKey: ['projects', projectId, 'jobs'],
    queryFn: () => api.get<JobDto[]>(`/projects/${projectId}/jobs`),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((j) => j.queueName === 'editing' && ACTIVE_STATUSES.has(j.status)) ? 2000 : false;
    },
  });

  const runMutation = useMutation({
    mutationFn: () => api.post<JobDto>(base),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: 'Editing pipeline queued' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not run editing pipeline',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const latestEditingJob = (jobsQuery.data ?? []).find((j) => j.queueName === 'editing' && j.sectionId === sectionId);
  const isActive = latestEditingJob && ACTIVE_STATUSES.has(latestEditingJob.status);

  // Once the editing pipeline job for this section completes, reload its passes — nothing else
  // refetches this query, and the mock provider can complete before the jobs list is even polled once.
  const prevJobStatus = useRef(latestEditingJob?.status);
  useEffect(() => {
    if (prevJobStatus.current !== 'completed' && latestEditingJob?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'edit-passes', sectionId] });
    }
    prevJobStatus.current = latestEditingJob?.status;
  }, [latestEditingJob?.status, projectId, queryClient, sectionId]);

  const latestBatchId = passesQuery.data?.[0]?.batchId;
  const latestPasses = (passesQuery.data ?? []).filter((p) => p.batchId === latestBatchId);

  return (
    <div className="space-y-3 overflow-y-auto p-3">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          Runs 7 passes (grammar, clarity, consistency, structure, fact-checking, AI-detection-risk, final review) and
          stores each one separately.
        </p>
        <Button size="sm" disabled={runMutation.isPending || isActive} onClick={() => runMutation.mutate()}>
          <ShieldCheck className="h-3.5 w-3.5" />
          {isActive ? `Running (${latestEditingJob?.status})…` : 'Run editing pipeline'}
        </Button>
      </div>

      {passesQuery.isLoading && <Skeleton className="h-24 w-full" />}
      {!passesQuery.isLoading && latestPasses.length === 0 && (
        <p className="text-sm text-muted-foreground">No editing pipeline runs yet.</p>
      )}
      {latestPasses.map((pass) => (
        <div key={pass.id} className="rounded-md border p-2.5 text-sm">
          <p className="font-medium">{PASS_LABELS[pass.passType] ?? pass.passType}</p>
          <p className="mt-1 text-muted-foreground">{pass.summary}</p>
          {pass.findings.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No issues flagged.</p>}
          {pass.findings.map((finding, i) => (
            <div key={i} className="mt-1.5 flex items-start justify-between gap-2 border-t pt-1.5 text-xs">
              <span>{finding.description}</span>
              <Badge variant={SEVERITY_VARIANT[finding.severity] ?? 'secondary'}>{finding.severity}</Badge>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
