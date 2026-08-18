import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { BookIdeaDto, BookSpecificationDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { IdeaCard } from './idea-card';
import { CreateSpecificationDialog } from './create-specification-dialog';

export function BookGeneratorPanel({ projectId }: { projectId: string }) {
  const [count, setCount] = useState(5);
  const [specDialogIdea, setSpecDialogIdea] = useState<BookIdeaDto | null>(null);
  const queryClient = useQueryClient();

  const ideasQuery = useQuery({
    queryKey: ['projects', projectId, 'ideas'],
    queryFn: () => api.get<BookIdeaDto[]>(`/projects/${projectId}/ideas`),
  });

  const specQuery = useQuery({
    queryKey: ['projects', projectId, 'specification'],
    queryFn: () => api.get<BookSpecificationDto>(`/projects/${projectId}/specification`),
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<BookIdeaDto[]>(`/projects/${projectId}/ideas`, { count }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'ideas'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast({ title: 'Ideas generated' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not generate ideas',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const hasSpec = Boolean(specQuery.data);
  const savedIdeasWithoutSpec = (ideasQuery.data ?? []).filter((idea) => idea.status === 'saved');

  if (hasSpec && specQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book specification</CardTitle>
          <CardDescription>The canonical spec downstream generation stages will reference.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Working title" value={specQuery.data.workingTitle} />
          <Row label="Subtitle" value={specQuery.data.subtitle || '—'} />
          <Row label="Audience" value={specQuery.data.audience} />
          <Row label="Tone" value={specQuery.data.tone} />
          <Row label="Reading level" value={specQuery.data.readingLevel} />
          <Row label="Trim size" value={`${specQuery.data.trimSizeId} in`} />
          <Row label="Estimated pages" value={String(specQuery.data.estimatedPageCount)} />
          <Row label="Chapters" value={String(specQuery.data.chapterCount || '—')} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book Generator</CardTitle>
          <CardDescription>
            Generate candidate ideas from this project's niche, select one, then create the book specification.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="count">Number of ideas</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={10}
              className="w-24"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
            <Sparkles className="h-4 w-4" />
            {generateMutation.isPending ? 'Generating…' : 'Generate ideas'}
          </Button>
        </CardContent>
      </Card>

      {savedIdeasWithoutSpec.length > 0 && (
        <Card className="border-primary/40 bg-accent/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">
              <span className="font-medium">{savedIdeasWithoutSpec[0]!.title}</span> is selected — ready to create the
              book specification.
            </p>
            <Button size="sm" onClick={() => setSpecDialogIdea(savedIdeasWithoutSpec[0]!)}>
              Create specification
            </Button>
          </CardContent>
        </Card>
      )}

      {ideasQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!ideasQuery.isLoading && ideasQuery.data && ideasQuery.data.length === 0 && (
        <p className="text-sm text-muted-foreground">No ideas generated yet — click "Generate ideas" above.</p>
      )}

      {ideasQuery.data && ideasQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ideasQuery.data.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} projectId={projectId} />
          ))}
        </div>
      )}

      {specDialogIdea && (
        <CreateSpecificationDialog
          projectId={projectId}
          idea={specDialogIdea}
          open={Boolean(specDialogIdea)}
          onOpenChange={(open) => !open && setSpecDialogIdea(null)}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
