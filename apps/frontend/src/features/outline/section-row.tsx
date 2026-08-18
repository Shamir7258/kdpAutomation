import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Pencil, Sparkles, Trash2 } from 'lucide-react';
import type { SectionDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export function SectionRow({
  section,
  projectId,
  chapterId,
  dragProps,
}: {
  section: SectionDto;
  projectId: string;
  chapterId: string;
  dragProps: {
    draggable: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    isDragging: boolean;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);
  const queryClient = useQueryClient();
  const base = `/projects/${projectId}/outline/chapters/${chapterId}/sections/${section.id}`;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'outline'] });
  const onError = (action: string) => (err: unknown) =>
    toast({
      variant: 'destructive',
      title: `Could not ${action} section`,
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

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm',
        dragProps.isDragging && 'opacity-40',
      )}
      draggable={dragProps.draggable}
      onDragStart={dragProps.onDragStart}
      onDragOver={dragProps.onDragOver}
      onDrop={dragProps.onDrop}
    >
      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
      {editing ? (
        <Input
          autoFocus
          className="h-7"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && renameMutation.mutate()}
        />
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{section.title}</p>
          {section.summary && <p className="truncate text-xs text-muted-foreground">{section.summary}</p>}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {editing ? (
          <Button size="sm" variant="outline" disabled={renameMutation.isPending} onClick={() => renameMutation.mutate()}>
            Save
          </Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={regenerateMutation.isPending}
          onClick={() => regenerateMutation.mutate()}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
