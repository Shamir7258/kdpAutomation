import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { JobDto, SectionContentDto, SectionDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

const JOB_BADGE_VARIANT: Record<string, 'secondary' | 'success' | 'destructive' | 'warning'> = {
  pending: 'secondary',
  running: 'warning',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
};

export function SectionContentRow({
  section,
  projectId,
  chapterId,
  activeJob,
}: {
  section: SectionDto;
  projectId: string;
  chapterId: string;
  activeJob?: JobDto;
}) {
  const queryClient = useQueryClient();
  const base = `/projects/${projectId}/content/chapters/${chapterId}/sections/${section.id}`;

  const contentQuery = useQuery({
    queryKey: ['projects', projectId, 'content', section.id],
    queryFn: () => api.get<SectionContentDto>(base),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post(base),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: `Queued: ${section.title}` });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not queue generation',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  // The jobs list polls on its own interval (see ContentPanel), but this section's own content
  // query does not — without this, the "completed" badge appears yet the button/preview stay
  // stale until something else happens to trigger a refetch. Refetch once, exactly when the job
  // for this section first flips to "completed".
  const previousJobStatus = useRef(activeJob?.status);
  useEffect(() => {
    if (previousJobStatus.current !== 'completed' && activeJob?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'content', section.id] });
    }
    previousJobStatus.current = activeJob?.status;
  }, [activeJob?.status, queryClient, projectId, section.id]);

  const hasContent = Boolean(contentQuery.data?.currentContent);
  const isActive = activeJob && (activeJob.status === 'pending' || activeJob.status === 'running');

  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{section.title}</p>
          {contentQuery.data && contentQuery.data.versionCount > 0 && (
            <p className="text-xs text-muted-foreground">
              v{contentQuery.data.currentVersionNumber} of {contentQuery.data.versionCount}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeJob && <Badge variant={JOB_BADGE_VARIANT[activeJob.status] ?? 'secondary'}>{activeJob.status}</Badge>}
          <Button
            size="sm"
            variant={hasContent ? 'outline' : 'default'}
            disabled={generateMutation.isPending || isActive}
            onClick={() => generateMutation.mutate()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {hasContent ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>
      {activeJob?.status === 'failed' && activeJob.error && (
        <p className="mt-2 text-xs text-destructive">{activeJob.error}</p>
      )}
      {hasContent && contentQuery.data?.currentContent && (
        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{contentQuery.data.currentContent}</p>
      )}
    </div>
  );
}
