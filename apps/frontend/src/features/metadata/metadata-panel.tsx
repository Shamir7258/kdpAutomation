import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Tags } from 'lucide-react';
import type { MetadataDto, UpdateMetadataInput } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

interface FormState {
  title: string;
  subtitle: string;
  seriesName: string;
  seriesNumber: string;
  description: string;
  keywords: string;
  categories: string;
  authorName: string;
  primaryMarketplace: string;
  currency: string;
  listPrice: string;
}

function toFormState(metadata: MetadataDto): FormState {
  return {
    title: metadata.title,
    subtitle: metadata.subtitle,
    seriesName: metadata.seriesName,
    seriesNumber: metadata.seriesNumber ? String(metadata.seriesNumber) : '',
    description: metadata.description,
    keywords: metadata.keywords.join(', '),
    categories: metadata.categories.join(', '),
    authorName: metadata.authorName,
    primaryMarketplace: metadata.primaryMarketplace,
    currency: metadata.pricing?.currency ?? 'USD',
    listPrice: metadata.pricing?.listPrice ? String(metadata.pricing.listPrice) : '',
  };
}

export function MetadataPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const base = `/projects/${projectId}/metadata`;

  const metadataQuery = useQuery({
    queryKey: ['projects', projectId, 'metadata'],
    queryFn: () => api.get<MetadataDto>(base),
    retry: false,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const loadedId = metadataQuery.data?.id;
  useEffect(() => {
    if (metadataQuery.data) setForm(toFormState(metadataQuery.data));
  }, [loadedId]);

  const generateMutation = useMutation({
    mutationFn: () => api.post<MetadataDto>(base),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'metadata'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      setForm(toFormState(data));
      toast({ title: 'Metadata suggestions generated' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not generate metadata',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const keywords = splitList(form!.keywords);
      const categories = splitList(form!.categories);
      const input: UpdateMetadataInput = {
        title: form!.title,
        subtitle: form!.subtitle,
        seriesName: form!.seriesName,
        seriesNumber: form!.seriesNumber ? Number(form!.seriesNumber) : undefined,
        description: form!.description,
        keywords,
        categories,
        authorName: form!.authorName,
        primaryMarketplace: form!.primaryMarketplace,
        pricing: form!.listPrice ? { currency: form!.currency, listPrice: Number(form!.listPrice) } : undefined,
      };
      return api.patch<MetadataDto>(base, input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'metadata'] });
      setForm(toFormState(data));
      toast({ title: 'Metadata saved' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not save metadata',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  if (metadataQuery.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!metadataQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
          <CardDescription>
            AI-suggested title options, description, keywords, and categories for the KDP listing — review and
            finalize everything before publishing. Requires a book specification (and ideally an outline).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
            <Sparkles className="h-4 w-4" />
            {generateMutation.isPending ? 'Generating…' : 'Generate metadata'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const metadata = metadataQuery.data;
  const keywordCount = form ? splitList(form.keywords).length : 0;
  const categoryCount = form ? splitList(form.categories).length : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Metadata</CardTitle>
            <CardDescription>Finalize the listing details KDP will show shoppers.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generateMutation.isPending ? 'Regenerating…' : 'Regenerate suggestions'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata.aiSuggestions.titles.length > 1 && (
          <div className="space-y-1.5 rounded-md border bg-accent/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Tags className="h-3.5 w-3.5" />
              Other AI title suggestions — click to use
            </p>
            <div className="flex flex-wrap gap-1.5">
              {metadata.aiSuggestions.titles.map((title) => (
                <button
                  key={title}
                  type="button"
                  className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-accent"
                  onClick={() => setForm((f) => (f ? { ...f, title } : f))}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
        )}

        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meta-title">Title</Label>
              <Input id="meta-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meta-subtitle">Subtitle</Label>
              <Input
                id="meta-subtitle"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-series-name">Series name (optional)</Label>
              <Input
                id="meta-series-name"
                value={form.seriesName}
                onChange={(e) => setForm({ ...form, seriesName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-series-number">Series number (optional)</Label>
              <Input
                id="meta-series-number"
                type="number"
                min={1}
                value={form.seriesNumber}
                onChange={(e) => setForm({ ...form, seriesNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meta-description">Description ({form.description.length}/4000)</Label>
              <Textarea
                id="meta-description"
                rows={6}
                maxLength={4000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meta-keywords">
                Keywords, comma-separated ({keywordCount}/7 — KDP allows up to 7 keyword phrases)
              </Label>
              <Input id="meta-keywords" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="meta-categories">Categories, comma-separated ({categoryCount}/10)</Label>
              <Input
                id="meta-categories"
                value={form.categories}
                onChange={(e) => setForm({ ...form, categories: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-author">Author name</Label>
              <Input
                id="meta-author"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-marketplace">Primary marketplace</Label>
              <Input
                id="meta-marketplace"
                value={form.primaryMarketplace}
                onChange={(e) => setForm({ ...form, primaryMarketplace: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-currency">Currency (optional — you set the price, not AI)</Label>
              <Input
                id="meta-currency"
                maxLength={3}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meta-price">List price (optional)</Label>
              <Input
                id="meta-price"
                type="number"
                min={0}
                step="0.01"
                value={form.listPrice}
                onChange={(e) => setForm({ ...form, listPrice: e.target.value })}
              />
            </div>
          </div>
        )}

        {keywordCount > 7 && <Badge variant="destructive">Too many keywords — KDP allows at most 7</Badge>}

        <Button disabled={saveMutation.isPending || keywordCount > 7} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Saving…' : 'Save metadata'}
        </Button>
      </CardContent>
    </Card>
  );
}
