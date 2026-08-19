import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Package } from 'lucide-react';
import type { ExportDto, JobDto } from '@kdp/shared';
import { api, ApiError, downloadFile } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

const ACTIVE_STATUSES = new Set(['pending', 'running']);

function formatFileSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function ExportPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const exportsQuery = useQuery({
    queryKey: ['projects', projectId, 'export'],
    queryFn: () => api.get<ExportDto[]>(`/projects/${projectId}/export`),
  });

  const jobsQuery = useQuery({
    queryKey: ['projects', projectId, 'jobs'],
    queryFn: () => api.get<JobDto[]>(`/projects/${projectId}/jobs`),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((j) => j.queueName === 'export' && ACTIVE_STATUSES.has(j.status)) ? 2000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<JobDto>(`/projects/${projectId}/export`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: 'Generating export package…' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not generate export package',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const latestExportJob = (jobsQuery.data ?? [])
    .filter((j) => j.queueName === 'export' && j.chapterId === null && j.sectionId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const isActive = latestExportJob && ACTIVE_STATUSES.has(latestExportJob.status);

  // The jobs list polls on its own interval, but the export list does not — without this, a
  // freshly completed generation never shows up until something else triggers a refetch.
  const previousJobStatus = useRef(latestExportJob?.status);
  useEffect(() => {
    if (previousJobStatus.current !== 'completed' && latestExportJob?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'export'] });
    }
    previousJobStatus.current = latestExportJob?.status;
  }, [latestExportJob?.status, projectId, queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Export</CardTitle>
        <CardDescription>
          Bundle your interior, cover files, and metadata into one ZIP you can use to complete your KDP submission —
          this does not upload or publish anything automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Button disabled={generateMutation.isPending || isActive} onClick={() => generateMutation.mutate()}>
            <Package className="h-4 w-4" />
            {isActive ? `Generating (${latestExportJob?.status})…` : 'Generate export package'}
          </Button>
        </div>
        {latestExportJob?.status === 'failed' && latestExportJob.error && (
          <p className="text-xs text-destructive">{latestExportJob.error}</p>
        )}

        {exportsQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {!exportsQuery.isLoading && (exportsQuery.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No export packages generated yet.</p>
        )}
        {(exportsQuery.data ?? []).length > 0 && (
          <div className="space-y-2">
            {exportsQuery.data!.map((exportItem) => (
              <div key={exportItem.id} className="flex items-start gap-3 rounded-md border p-2.5 text-sm">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">{formatFileSize(exportItem.fileSizeBytes)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {new Date(exportItem.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {exportItem.includedFiles.map((file) => (
                      <Badge key={file} variant="secondary">
                        {file}
                      </Badge>
                    ))}
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadFile(exportItem.url, `export-${exportItem.id}.zip`).catch((err) =>
                          toast({
                            variant: 'destructive',
                            title: 'Could not download',
                            description: err instanceof ApiError ? err.message : 'Something went wrong.',
                          }),
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download ZIP
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
