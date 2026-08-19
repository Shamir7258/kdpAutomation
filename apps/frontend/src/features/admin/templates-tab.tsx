import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import type { PromptTemplateDto } from '@kdp/shared';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateFormDialog } from './template-form-dialog';

export function TemplatesTab() {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PromptTemplateDto | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['prompt-templates'],
    queryFn: () => api.get<PromptTemplateDto[]>('/prompt-templates'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {templatesQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!templatesQuery.isLoading && templatesQuery.data?.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No prompt templates yet.
        </div>
      )}

      {!templatesQuery.isLoading && templatesQuery.data && templatesQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {templatesQuery.data.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="secondary">v{template.version}</Badge>
                    <Badge variant={template.active ? 'success' : 'outline'}>
                      {template.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <CardDescription>{template.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">System prompt</p>
                  <p className="line-clamp-2">{template.systemPrompt}</p>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">User prompt</p>
                  <p className="line-clamp-2">{template.userPrompt}</p>
                </div>
                {template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {template.variables.map((v) => (
                      <Badge key={v} variant="outline" className="font-mono">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button variant="outline" size="sm" className="mt-auto self-start" onClick={() => setEditing(template)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateFormDialog open={creating} onOpenChange={setCreating} />
      <TemplateFormDialog
        template={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      />
    </div>
  );
}
