import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Download, FileDown } from 'lucide-react';
import { INTERIOR_FORMATS, TRIM_SIZE_IDS, type InteriorDto, type InteriorFormat, type JobDto } from '@kdp/shared';
import { api, ApiError, downloadFile } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const FORMAT_LABELS: Record<InteriorFormat, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  docx: 'DOCX',
};

const SPEC_TRIM_SIZE = 'spec-default';

const ACTIVE_STATUSES = new Set(['pending', 'running']);

function formatFileSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function InteriorPanel({ projectId }: { projectId: string }) {
  const [format, setFormat] = useState<InteriorFormat>('pdf');
  const [trimSizeId, setTrimSizeId] = useState<string>(SPEC_TRIM_SIZE);
  const queryClient = useQueryClient();

  const interiorsQuery = useQuery({
    queryKey: ['projects', projectId, 'interior'],
    queryFn: () => api.get<InteriorDto[]>(`/projects/${projectId}/interior`),
  });

  const jobsQuery = useQuery({
    queryKey: ['projects', projectId, 'jobs'],
    queryFn: () => api.get<JobDto[]>(`/projects/${projectId}/jobs`),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((j) => j.queueName === 'document-generation' && ACTIVE_STATUSES.has(j.status)) ? 2000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<JobDto>(`/projects/${projectId}/interior`, {
        format,
        trimSizeId: trimSizeId === SPEC_TRIM_SIZE ? undefined : trimSizeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: 'Generating interior…' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not generate interior',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const latestInteriorJob = (jobsQuery.data ?? [])
    .filter((j) => j.queueName === 'document-generation' && j.chapterId === null && j.sectionId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const isActive = latestInteriorJob && ACTIVE_STATUSES.has(latestInteriorJob.status);

  // The jobs list polls on its own interval, but the interior list does not — without this, a
  // freshly completed generation never shows up until something else triggers a refetch.
  const previousJobStatus = useRef(latestInteriorJob?.status);
  useEffect(() => {
    if (previousJobStatus.current !== 'completed' && latestInteriorJob?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'interior'] });
    }
    previousJobStatus.current = latestInteriorJob?.status;
  }, [latestInteriorJob?.status, projectId, queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Interior</CardTitle>
        <CardDescription>Render the book's content into a print- or e-reader-ready PDF, EPUB, or DOCX file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Format</p>
            <Select value={format} onValueChange={(v) => setFormat(v as InteriorFormat)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERIOR_FORMATS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Trim size</p>
            <Select value={trimSizeId} onValueChange={setTrimSizeId}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SPEC_TRIM_SIZE}>Use book specification's trim size</SelectItem>
                {TRIM_SIZE_IDS.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size} in
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={generateMutation.isPending || isActive} onClick={() => generateMutation.mutate()}>
            <FileDown className="h-4 w-4" />
            {isActive ? `Generating (${latestInteriorJob?.status})…` : 'Generate interior'}
          </Button>
        </div>
        {latestInteriorJob?.status === 'failed' && latestInteriorJob.error && (
          <p className="text-xs text-destructive">{latestInteriorJob.error}</p>
        )}

        {interiorsQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {!interiorsQuery.isLoading && (interiorsQuery.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No interiors generated yet.</p>
        )}
        {(interiorsQuery.data ?? []).length > 0 && (
          <div className="space-y-2">
            {interiorsQuery.data!.map((interior) => (
              <div key={interior.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <Badge variant="secondary">{FORMAT_LABELS[interior.format]}</Badge>
                  <span className="text-muted-foreground">{interior.trimSizeId} in</span>
                  <span className="text-muted-foreground">{formatFileSize(interior.fileSizeBytes)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {new Date(interior.createdAt).toLocaleString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadFile(interior.url, `interior-${interior.id}.${interior.format}`).catch((err) =>
                      toast({
                        variant: 'destructive',
                        title: 'Could not download',
                        description: err instanceof ApiError ? err.message : 'Something went wrong.',
                      }),
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
