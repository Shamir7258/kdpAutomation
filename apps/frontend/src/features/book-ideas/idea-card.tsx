import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { BookIdeaDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'destructive'> = {
  proposed: 'secondary',
  saved: 'success',
  rejected: 'destructive',
};

export function IdeaCard({ idea, projectId }: { idea: BookIdeaDto; projectId: string }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (status: 'saved' | 'rejected') =>
      api.patch(`/projects/${projectId}/ideas/${idea.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'ideas'] });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not update idea',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{idea.title}</CardTitle>
          <Badge variant={STATUS_VARIANT[idea.status] ?? 'secondary'}>{idea.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{idea.subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="font-medium">Audience: </span>
          {idea.targetAudience}
        </p>
        <p>
          <span className="font-medium">Problem solved: </span>
          {idea.problemSolved}
        </p>
        <p>
          <span className="font-medium">Unique angle: </span>
          {idea.uniqueAngle}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <span>~{idea.estimatedPageCount} pages</span>
          <span>·</span>
          <span className="capitalize">{idea.difficulty}</span>
        </div>
        {idea.potentialRisks.length > 0 && (
          <div>
            <span className="font-medium">Potential risks: </span>
            {idea.potentialRisks.join('; ')}
          </div>
        )}
        {idea.status === 'proposed' && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate('saved')}>
              <ThumbsUp className="h-3.5 w-3.5" />
              Select
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('rejected')}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
