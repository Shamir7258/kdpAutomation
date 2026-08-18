import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PROJECT_STATUSES, type Paginated, type ProjectDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectCard } from './project-card';

const ALL_STATUSES = '__all__';

export function ProjectsListPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'name'>('updatedAt');
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const query = useQuery({
    queryKey: ['projects', { search: debouncedSearch, status, sortBy, includeArchived }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status !== ALL_STATUSES) params.set('status', status);
      params.set('sortBy', sortBy);
      params.set('sortDir', 'desc');
      params.set('includeArchived', String(includeArchived));
      return api.get<Paginated<ProjectDto>>(`/projects?${params.toString()}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Every book you're working on, in one place.</p>
        </div>
        <CreateProjectDialog />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or niche…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt">Last updated</SelectItem>
            <SelectItem value="createdAt">Date created</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={includeArchived ? 'secondary' : 'outline'} size="sm" onClick={() => setIncludeArchived((v) => !v)}>
          {includeArchived ? 'Hide archived' : 'Show archived'}
        </Button>
      </div>

      {query.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!query.isLoading && query.data?.items.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No projects match your filters yet.
        </div>
      )}

      {!query.isLoading && query.data && query.data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
