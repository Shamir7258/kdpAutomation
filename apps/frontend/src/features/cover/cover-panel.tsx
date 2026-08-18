import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ImageIcon, Wand2 } from 'lucide-react';
import { PAPER_TYPES, type CoverDto, type JobDto, type PaperType } from '@kdp/shared';
import { api, ApiError, downloadFile, getAccessToken } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  white: 'White',
  cream: 'Cream',
  color: 'Color',
};

const ACTIVE_STATUSES = new Set(['pending', 'running']);

function CoverThumbnail({ url, alt }: { url: string; alt: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let localObjectUrl: string | null = null;

    async function load() {
      if (!url.startsWith('/')) {
        if (!cancelled) setObjectUrl(url);
        return;
      }
      const token = getAccessToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      localObjectUrl = URL.createObjectURL(blob);
      if (!cancelled) setObjectUrl(localObjectUrl);
    }
    load();

    return () => {
      cancelled = true;
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
    };
  }, [url]);

  if (!objectUrl) return <Skeleton className="h-32 w-24 shrink-0 rounded-md" />;
  return (
    <img
      src={objectUrl}
      alt={alt}
      className="h-32 w-24 shrink-0 rounded-md border object-contain"
    />
  );
}

export function CoverPanel({ projectId }: { projectId: string }) {
  const [paperType, setPaperType] = useState<PaperType>('white');
  const [stylePrompt, setStylePrompt] = useState('');
  const queryClient = useQueryClient();

  const coversQuery = useQuery({
    queryKey: ['projects', projectId, 'cover'],
    queryFn: () => api.get<CoverDto[]>(`/projects/${projectId}/cover`),
  });

  const jobsQuery = useQuery({
    queryKey: ['projects', projectId, 'jobs'],
    queryFn: () => api.get<JobDto[]>(`/projects/${projectId}/jobs`),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((j) => j.queueName === 'cover-generation' && ACTIVE_STATUSES.has(j.status)) ? 2000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post<JobDto>(`/projects/${projectId}/cover`, {
        paperType,
        stylePrompt: stylePrompt.trim() ? stylePrompt.trim() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: 'Generating cover…' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not generate cover',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const latestCoverJob = (jobsQuery.data ?? [])
    .filter((j) => j.queueName === 'cover-generation' && j.chapterId === null && j.sectionId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const isActive = latestCoverJob && ACTIVE_STATUSES.has(latestCoverJob.status);

  // The jobs list polls on its own interval, but the cover list does not — without this, a
  // freshly completed generation never shows up until something else triggers a refetch.
  const previousJobStatus = useRef(latestCoverJob?.status);
  useEffect(() => {
    if (previousJobStatus.current !== 'completed' && latestCoverJob?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'cover'] });
    }
    previousJobStatus.current = latestCoverJob?.status;
  }, [latestCoverJob?.status, projectId, queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cover</CardTitle>
        <CardDescription>
          Generate AI cover art with a print-ready front/spine/back wrap, sized to your book's page count using
          KDP's spine-width math.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Paper type</p>
            <Select value={paperType} onValueChange={(v) => setPaperType(v as PaperType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PAPER_TYPE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-56 flex-1 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Style prompt (optional)</p>
            <Input
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              maxLength={500}
              placeholder="extra art direction, e.g. 'moody, cinematic lighting'"
            />
          </div>
          <Button disabled={generateMutation.isPending || isActive} onClick={() => generateMutation.mutate()}>
            <Wand2 className="h-4 w-4" />
            {isActive ? `Generating (${latestCoverJob?.status})…` : 'Generate cover'}
          </Button>
        </div>
        {latestCoverJob?.status === 'failed' && latestCoverJob.error && (
          <p className="text-xs text-destructive">{latestCoverJob.error}</p>
        )}

        {coversQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {!coversQuery.isLoading && (coversQuery.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No covers generated yet.</p>
        )}
        {(coversQuery.data ?? []).length > 0 && (
          <div className="space-y-2">
            {coversQuery.data!.map((cover) => (
              <div key={cover.id} className="flex items-start gap-3 rounded-md border p-2.5 text-sm">
                <CoverThumbnail url={cover.ebookCoverUrl} alt={`Cover art for ${cover.id}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Badge variant="secondary">{PAPER_TYPE_LABELS[cover.paperType]}</Badge>
                    <span className="text-muted-foreground">Spine {cover.spineWidthIn.toFixed(3)}"</span>
                    <span className="text-muted-foreground">{cover.pageCount} pages</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {new Date(cover.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadFile(cover.wrapCoverPdfUrl, `cover-${cover.id}.pdf`).catch((err) =>
                          toast({
                            variant: 'destructive',
                            title: 'Could not download',
                            description: err instanceof ApiError ? err.message : 'Something went wrong.',
                          }),
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download wrap PDF
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
