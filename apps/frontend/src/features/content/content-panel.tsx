import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { ChapterDto, JobDto, ProjectDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { SectionContentRow } from './section-content-row';

const ACTIVE_STATUSES = new Set(['pending', 'running']);

export function ContentPanel({ project }: { project: ProjectDto }) {
  const projectId = project.id;
  const queryClient = useQueryClient();

  const outlineQuery = useQuery({
    queryKey: ['projects', projectId, 'outline'],
    queryFn: () => api.get<ChapterDto[]>(`/projects/${projectId}/outline`),
  });

  const jobsQuery = useQuery({
    queryKey: ['projects', projectId, 'jobs'],
    queryFn: () => api.get<JobDto[]>(`/projects/${projectId}/jobs`),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((j) => ACTIVE_STATUSES.has(j.status)) ? 2000 : false;
    },
  });

  const generateBookMutation = useMutation({
    mutationFn: () => api.post<JobDto[]>(`/projects/${projectId}/content`),
    onSuccess: (jobs) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: jobs.length > 0 ? `Queued ${jobs.length} section(s)` : 'Everything is already generated' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not queue book generation',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const chapters = outlineQuery.data ?? [];
  const jobsBySectionId = new Map((jobsQuery.data ?? []).map((j) => [j.sectionId, j]));

  if (!outlineQuery.isLoading && chapters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Generate an outline first.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Content</CardTitle>
          <CardDescription>
            Generated chapter-by-chapter, section-by-section — never the whole book in one request. Already-generated
            sections are skipped automatically; use Regenerate to redo one explicitly.
          </CardDescription>
        </div>
        <Button size="sm" disabled={generateBookMutation.isPending} onClick={() => generateBookMutation.mutate()}>
          <Sparkles className="h-3.5 w-3.5" />
          {generateBookMutation.isPending ? 'Queuing…' : 'Generate all content'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {outlineQuery.isLoading && <Skeleton className="h-32 w-full" />}
        {chapters.map((chapter) => (
          <div key={chapter.id} className="space-y-2">
            <p className="text-sm font-semibold">{chapter.title}</p>
            <div className="space-y-2">
              {chapter.sections.map((section) => (
                <SectionContentRow
                  key={section.id}
                  section={section}
                  projectId={projectId}
                  chapterId={chapter.id}
                  activeJob={jobsBySectionId.get(section.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
