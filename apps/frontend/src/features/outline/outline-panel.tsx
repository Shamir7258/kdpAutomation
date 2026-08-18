import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import { getBookTypeDefinition, type BookTypeId, type ChapterDto, type ProjectDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { useDragReorder } from '@/lib/use-drag-reorder';
import { ChapterCard } from './chapter-card';

export function OutlinePanel({ project }: { project: ProjectDto }) {
  const projectId = project.id;
  const bookType = getBookTypeDefinition(project.bookType as BookTypeId);
  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const queryClient = useQueryClient();

  const outlineQuery = useQuery({
    queryKey: ['projects', projectId, 'outline'],
    queryFn: () => api.get<ChapterDto[]>(`/projects/${projectId}/outline`),
    enabled: bookType.supportsOutline,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'outline'] });
  const onError = (action: string) => (err: unknown) =>
    toast({
      variant: 'destructive',
      title: `Could not ${action}`,
      description: err instanceof ApiError ? err.message : 'Something went wrong.',
    });

  const generateMutation = useMutation({
    mutationFn: () => api.post<ChapterDto[]>(`/projects/${projectId}/outline`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast({ title: 'Outline generated' });
    },
    onError: onError('generate outline'),
  });
  const addChapterMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/outline/chapters`, { title: newChapterTitle }),
    onSuccess: () => {
      invalidate();
      setNewChapterTitle('');
      setAddingChapter(false);
    },
    onError: onError('add chapter'),
  });
  const reorderMutation = useMutation({
    mutationFn: (chapterIds: string[]) => api.post(`/projects/${projectId}/outline/chapters/reorder`, { chapterIds }),
    onSuccess: invalidate,
    onError: onError('reorder chapters'),
  });

  const chapters = outlineQuery.data ?? [];
  const chapterDrag = useDragReorder(chapters, (c) => c.id, (ids) => reorderMutation.mutate(ids));

  if (!bookType.supportsOutline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outline</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          "{bookType.label}" books don't use a chaptered outline — this step is skipped for this project.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Outline</CardTitle>
          <CardDescription>Drag chapters and sections to reorder. Requires a book specification first.</CardDescription>
        </div>
        <Button size="sm" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
          <Sparkles className="h-3.5 w-3.5" />
          {generateMutation.isPending ? 'Generating…' : chapters.length > 0 ? 'Regenerate all' : 'Generate outline'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {outlineQuery.isLoading && <Skeleton className="h-40 w-full" />}
        {!outlineQuery.isLoading && chapters.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No outline yet — click "Generate outline" above (needs a book specification first).
          </p>
        )}
        {chapters.map((chapter) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            projectId={projectId}
            dragProps={{
              draggable: true,
              onDragStart: () => chapterDrag.onDragStart(chapter.id),
              onDragOver: chapterDrag.onDragOver,
              onDrop: () => chapterDrag.onDrop(chapter.id),
              isDragging: chapterDrag.draggedId === chapter.id,
            }}
          />
        ))}
        {addingChapter ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Chapter title"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newChapterTitle && addChapterMutation.mutate()}
            />
            <Button disabled={!newChapterTitle || addChapterMutation.isPending} onClick={() => addChapterMutation.mutate()}>
              Add
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAddingChapter(true)}>
            <Plus className="h-4 w-4" />
            Add chapter
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
