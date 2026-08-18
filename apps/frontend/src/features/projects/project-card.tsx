import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Archive, ArchiveRestore, Trash2, Pencil } from 'lucide-react';
import type { ProjectDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { STATUS_BADGE_VARIANT } from './status-badge';
import { BOOK_TYPE_LABELS } from './book-type-labels';
import { RenameProjectDialog } from './rename-project-dialog';

export function ProjectCard({ project }: { project: ProjectDto }) {
  const [renaming, setRenaming] = useState(false);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
  };

  const onError = (err: unknown, action: string) =>
    toast({
      variant: 'destructive',
      title: `Could not ${action} project`,
      description: err instanceof ApiError ? err.message : 'Something went wrong.',
    });

  const duplicateMutation = useMutation({
    mutationFn: () => api.post<ProjectDto>(`/projects/${project.id}/duplicate`),
    onSuccess: invalidate,
    onError: (err) => onError(err, 'duplicate'),
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      project.archivedAt
        ? api.post<ProjectDto>(`/projects/${project.id}/restore`)
        : api.post<ProjectDto>(`/projects/${project.id}/archive`),
    onSuccess: invalidate,
    onError: (err) => onError(err, project.archivedAt ? 'restore' : 'archive'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${project.id}`),
    onSuccess: invalidate,
    onError: (err) => onError(err, 'delete'),
  });

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">
              <Link to={`/projects/${project.id}`} className="hover:underline">
                {project.name}
              </Link>
            </CardTitle>
            <Badge variant={STATUS_BADGE_VARIANT[project.status] ?? 'secondary'}>{project.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{BOOK_TYPE_LABELS[project.bookType as keyof typeof BOOK_TYPE_LABELS] ?? project.bookType}</p>
            <p className="line-clamp-1">{project.niche}</p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </Button>
            <Button variant="outline" size="sm" disabled={duplicateMutation.isPending} onClick={() => duplicateMutation.mutate()}>
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button variant="outline" size="sm" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate()}>
              {project.archivedAt ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {project.archivedAt ? 'Restore' : 'Archive'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete "${project.name}"? This can be undone by an admin.`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
      <RenameProjectDialog project={project} open={renaming} onOpenChange={setRenaming} />
    </>
  );
}
