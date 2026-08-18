import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { ResearchDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

export function ResearchPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const researchQuery = useQuery({
    queryKey: ['projects', projectId, 'research', 'latest'],
    queryFn: () => api.get<ResearchDto>(`/projects/${projectId}/research/latest`),
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post<ResearchDto>(`/projects/${projectId}/research`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'research'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast({ title: 'Research generated' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not generate research',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Research</CardTitle>
          <CardDescription>
            AI-synthesized niche research — directional brainstorming, not verified market data or a sales/ranking
            guarantee.
          </CardDescription>
        </div>
        <Button size="sm" disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
          <Search className="h-3.5 w-3.5" />
          {generateMutation.isPending ? 'Researching…' : researchQuery.data ? 'Regenerate' : 'Generate research'}
        </Button>
      </CardHeader>
      <CardContent>
        {researchQuery.isLoading && <Skeleton className="h-40 w-full" />}
        {!researchQuery.isLoading && !researchQuery.data && (
          <p className="text-sm text-muted-foreground">No research yet — click "Generate research" above.</p>
        )}
        {researchQuery.data && (
          <div className="space-y-4 text-sm">
            <Field label="Niche summary" value={researchQuery.data.nicheSummary} />
            <Field label="Audience" value={researchQuery.data.audience} />
            <ListField label="Potential topics" items={researchQuery.data.potentialTopics} />
            <ListField label="Potential subtopics" items={researchQuery.data.potentialSubtopics} />
            <ListField label="Search terms" items={researchQuery.data.searchTerms} />
            <ListField label="Competitor themes" items={researchQuery.data.competitorThemes} />
            <ListField label="Content opportunities" items={researchQuery.data.contentOpportunities} />
            <ListField label="Differentiation opportunities" items={researchQuery.data.differentiationOpportunities} />
            <ListField label="Risk warnings" items={researchQuery.data.riskWarnings} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{value}</p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-medium">{label}</p>
      <ul className="list-inside list-disc text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
