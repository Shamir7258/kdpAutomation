import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw } from 'lucide-react';
import type { ContentVersionDto, SectionContentDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

export function VersionsPanel({ projectId, chapterId, sectionId }: { projectId: string; chapterId: string; sectionId: string }) {
  const queryClient = useQueryClient();
  const base = `/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`;

  const versionsQuery = useQuery({
    queryKey: ['projects', projectId, 'content', sectionId, 'versions'],
    queryFn: () => api.get<ContentVersionDto[]>(`${base}/versions`),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionNumber: number) => api.post<SectionContentDto>(`${base}/versions/${versionNumber}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'content', sectionId] });
      toast({ title: 'Version restored' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not restore version',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const current = versionsQuery.data?.find((v) => v.versionNumber === Math.max(...(versionsQuery.data?.map((x) => x.versionNumber) ?? [0])));

  return (
    <div className="space-y-2 overflow-y-auto p-3">
      {versionsQuery.isLoading && <Skeleton className="h-24 w-full" />}
      {!versionsQuery.isLoading && versionsQuery.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No versions yet.</p>
      )}
      {versionsQuery.data?.map((version) => (
        <div key={version.id} className="rounded-md border p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium">
              <History className="h-3.5 w-3.5" />
              v{version.versionNumber}
              {version.id === current?.id && <Badge variant="success">current</Badge>}
            </span>
            <Badge variant="secondary">{version.source === 'ai_generated' ? 'AI' : 'manual'}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{version.content}</p>
          <p className="mt-1 text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
          {version.id !== current?.id && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(version.versionNumber)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
