import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import type { ProjectDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_BADGE_VARIANT } from './status-badge';
import { BOOK_TYPE_LABELS } from './book-type-labels';
import { BookGeneratorPanel } from '@/features/book-ideas/book-generator-panel';
import { ResearchPanel } from '@/features/research/research-panel';
import { OutlinePanel } from '@/features/outline/outline-panel';
import { ContentPanel } from '@/features/content/content-panel';
import { MetadataPanel } from '@/features/metadata/metadata-panel';
import { InteriorPanel } from '@/features/interior/interior-panel';
import { CoverPanel } from '@/features/cover/cover-panel';
import { ValidationPanel } from '@/features/validation/validation-panel';
import { ExportPanel } from '@/features/export/export-panel';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<ProjectDto>(`/projects/${id}`),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const project = query.data;
  if (!project) return null;

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <Badge variant={STATUS_BADGE_VARIANT[project.status] ?? 'secondary'}>{project.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Book type" value={BOOK_TYPE_LABELS[project.bookType as keyof typeof BOOK_TYPE_LABELS] ?? project.bookType} />
            <Row label="Niche" value={project.niche} />
            <Row label="Target audience" value={project.targetAudience || '—'} />
            <Row label="Language" value={project.language.toUpperCase()} />
            <Row label="Created" value={new Date(project.createdAt).toLocaleString()} />
            <Row label="Last updated" value={new Date(project.updatedAt).toLocaleString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(project.workflowStatus).map(([stage, stageStatus]) => (
              <div key={stage} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{stage}</span>
                <Badge variant={stageStatus === 'completed' ? 'success' : stageStatus === 'running' ? 'warning' : 'secondary'}>
                  {stageStatus}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ResearchPanel projectId={project.id} />

      <BookGeneratorPanel projectId={project.id} />

      <OutlinePanel project={project} />

      <ContentPanel project={project} />

      <MetadataPanel projectId={project.id} />

      <InteriorPanel projectId={project.id} />

      <CoverPanel projectId={project.id} />

      <ValidationPanel projectId={project.id} />

      <ExportPanel projectId={project.id} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
