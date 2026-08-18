import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { ChapterDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { useDragReorder } from '@/lib/use-drag-reorder';
import { cn } from '@/lib/utils';
import { SectionRow } from './section-row';

export function ChapterCard({
  chapter,
  projectId,
  dragProps,
}: {
  chapter: ChapterDto;
  projectId: string;
  dragProps: {
    draggable: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    isDragging: boolean;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const queryClient = useQueryClient();
  const base = `/projects/${projectId}/outline/chapters/${chapter.id}`;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'outline'] });
  const onError = (action: string) => (err: unknown) =>
    toast({
      variant: 'destructive',
      title: `Could not ${action} chapter`,
      description: err instanceof ApiError ? err.message : 'Something went wrong.',
    });

  const renameMutation = useMutation({
    mutationFn: () => api.patch(base, { title }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
    },
    onError: onError('rename'),
  });
  const deleteMutation = useMutation({ mutationFn: () => api.delete(base), onSuccess: invalidate, onError: onError('delete') });
  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`${base}/regenerate`),
    onSuccess: invalidate,
    onError: onError('regenerate'),
  });
  const addSectionMutation = useMutation({
    mutationFn: () => api.post(`${base}/sections`, { title: newSectionTitle }),
    onSuccess: () => {
      invalidate();
      setNewSectionTitle('');
      setAddingSection(false);
    },
    onError: onError('add section to'),
  });
  const reorderSectionsMutation = useMutation({
    mutationFn: (sectionIds: string[]) => api.post(`${base}/sections/reorder`, { sectionIds }),
    onSuccess: invalidate,
    onError: onError('reorder sections in'),
  });

  const sectionDrag = useDragReorder(chapter.sections, (s) => s.id, (ids) => reorderSectionsMutation.mutate(ids));

  return (
    <Card
      className={cn(dragProps.isDragging && 'opacity-40')}
      draggable={dragProps.draggable}
      onDragStart={dragProps.onDragStart}
      onDragOver={dragProps.onDragOver}
      onDrop={dragProps.onDrop}
    >
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
        {editing ? (
          <Input
            autoFocus
            className="h-8"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && renameMutation.mutate()}
          />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{chapter.title}</p>
            {chapter.summary && <p className="text-sm text-muted-foreground">{chapter.summary}</p>}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <Button size="sm" variant="outline" disabled={renameMutation.isPending} onClick={() => renameMutation.mutate()}>
              Save
            </Button>
          ) : (
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" disabled={regenerateMutation.isPending} onClick={() => regenerateMutation.mutate()}>
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {chapter.sections.map((section) => (
          <SectionRow
            key={section.id}
            section={section}
            projectId={projectId}
            chapterId={chapter.id}
            dragProps={{
              draggable: true,
              onDragStart: () => sectionDrag.onDragStart(section.id),
              onDragOver: sectionDrag.onDragOver,
              onDrop: () => sectionDrag.onDrop(section.id),
              isDragging: sectionDrag.draggedId === section.id,
            }}
          />
        ))}
        {addingSection ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Section title"
              className="h-8"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newSectionTitle && addSectionMutation.mutate()}
            />
            <Button size="sm" disabled={!newSectionTitle || addSectionMutation.isPending} onClick={() => addSectionMutation.mutate()}>
              Add
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setAddingSection(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add section
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
