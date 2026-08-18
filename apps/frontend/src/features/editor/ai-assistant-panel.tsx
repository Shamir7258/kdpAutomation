import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Wand2 } from 'lucide-react';
import type { AssistantAction, AssistantResult } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import type { EditorSelection } from './tiptap-editor';

const QUICK_ACTIONS: Array<{ action: AssistantAction; label: string }> = [
  { action: 'rewrite', label: 'Rewrite this' },
  { action: 'simplify', label: 'Make it simpler' },
  { action: 'expand', label: 'Expand this section' },
  { action: 'shorten', label: 'Shorten this' },
  { action: 'improve', label: 'Improve writing' },
  { action: 'alternatives', label: 'Generate 3 alternatives' },
  { action: 'exercises', label: 'Create exercises' },
  { action: 'questions', label: 'Create questions' },
  { action: 'fact_check', label: 'Check factual consistency' },
];

const SEVERITY_VARIANT: Record<string, 'secondary' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
};

export function AiAssistantPanel({
  projectId,
  chapterId,
  sectionId,
  selection,
  onApplyResult,
}: {
  projectId: string;
  chapterId: string;
  sectionId: string;
  selection: EditorSelection;
  onApplyResult: (text: string, range: { from: number; to: number }) => void;
}) {
  const [ageRange, setAgeRange] = useState('8-12');
  const [customInstruction, setCustomInstruction] = useState('');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [pendingRange, setPendingRange] = useState<{ from: number; to: number } | null>(null);

  const base = `/projects/${projectId}/chapters/${chapterId}/sections/${sectionId}/assistant`;

  const mutation = useMutation({
    mutationFn: (body: { action: AssistantAction; instruction?: string; ageRange?: string }) =>
      api.post<AssistantResult>(base, { ...body, selectedText: selection.text || undefined }),
    onSuccess: (data) => {
      setResult(data);
      setPendingRange({ from: selection.from, to: selection.to });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Assistant action failed',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const run = (action: AssistantAction, extra?: { instruction?: string; ageRange?: string }) => {
    setResult(null);
    mutation.mutate({ action, ...extra });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {selection.text ? 'Operating on your selection' : 'Operating on the whole section'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map(({ action, label }) => (
            <Button key={action} size="sm" variant="outline" disabled={mutation.isPending} onClick={() => run(action)}>
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border p-2.5">
        <p className="text-xs font-medium text-muted-foreground">Make age-appropriate</p>
        <div className="flex gap-1.5">
          <Input value={ageRange} onChange={(e) => setAgeRange(e.target.value)} placeholder="e.g. 8-12" className="h-8" />
          <Button size="sm" disabled={mutation.isPending || !ageRange} onClick={() => run('age_appropriate', { ageRange })}>
            Go
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 rounded-md border p-2.5">
        <p className="text-xs font-medium text-muted-foreground">Custom instruction</p>
        <div className="flex gap-1.5">
          <Input
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="e.g. add a real-world example"
            className="h-8"
          />
          <Button
            size="sm"
            disabled={mutation.isPending || !customInstruction}
            onClick={() => run('custom', { instruction: customInstruction })}
          >
            Go
          </Button>
        </div>
      </div>

      {mutation.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" /> Thinking…
        </p>
      )}

      {result && result.kind === 'text' && pendingRange && (
        <div className="space-y-2 rounded-md border bg-accent/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Suggestion</p>
          <p className="text-sm">{result.text}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onApplyResult(result.text, pendingRange)}>
              <Wand2 className="h-3.5 w-3.5" />
              Insert
            </Button>
            <Button size="sm" variant="outline" onClick={() => setResult(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {result && result.kind === 'alternatives' && pendingRange && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Alternatives</p>
          {result.alternatives.map((alt, i) => (
            <div key={i} className="space-y-2 rounded-md border bg-accent/40 p-3">
              <p className="text-sm">{alt}</p>
              <Button size="sm" onClick={() => onApplyResult(alt, pendingRange)}>
                <Wand2 className="h-3.5 w-3.5" />
                Use this
              </Button>
            </div>
          ))}
        </div>
      )}

      {result && result.kind === 'analysis' && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">Analysis</p>
          <p className="text-sm">{result.summary}</p>
          {result.findings.length === 0 && <p className="text-sm text-muted-foreground">No issues flagged.</p>}
          {result.findings.map((finding, i) => (
            <div key={i} className="flex items-start justify-between gap-2 border-t pt-2 text-sm">
              <span>{finding.description}</span>
              <Badge variant={SEVERITY_VARIANT[finding.severity] ?? 'secondary'}>{finding.severity}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
