import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ChapterDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function SectionNavigator({
  projectId,
  activeChapterId,
  activeSectionId,
}: {
  projectId: string;
  activeChapterId: string;
  activeSectionId: string;
}) {
  const outlineQuery = useQuery({
    queryKey: ['projects', projectId, 'outline'],
    queryFn: () => api.get<ChapterDto[]>(`/projects/${projectId}/outline`),
  });

  if (outlineQuery.isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  return (
    <nav className="space-y-3 overflow-y-auto p-3 text-sm">
      {outlineQuery.data?.map((chapter) => (
        <div key={chapter.id}>
          <p className="mb-1 truncate font-medium text-muted-foreground">{chapter.title}</p>
          <div className="space-y-0.5">
            {chapter.sections.map((section) => (
              <Link
                key={section.id}
                to={`/projects/${projectId}/editor/${chapter.id}/${section.id}`}
                className={cn(
                  'block truncate rounded-md px-2 py-1.5 hover:bg-accent',
                  chapter.id === activeChapterId && section.id === activeSectionId && 'bg-accent font-medium text-accent-foreground',
                )}
              >
                {section.title}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
