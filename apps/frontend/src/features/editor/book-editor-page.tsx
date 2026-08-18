import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Save, Sparkles } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { JobDto, SectionContentDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { SectionNavigator } from './section-navigator';
import { TiptapEditor, type EditorSelection } from './tiptap-editor';
import { AiAssistantPanel } from './ai-assistant-panel';
import { VersionsPanel } from './versions-panel';
import { EditPassesPanel } from './edit-passes-panel';

const ACTIVE_STATUSES = new Set(['pending', 'running']);

export function BookEditorPage() {
  const { id: projectId, chapterId, sectionId } = useParams<{ id: string; chapterId: string; sectionId: string }>();
  const queryClient = useQueryClient();

  const [editor, setEditor] = useState<Editor | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [selection, setSelection] = useState<EditorSelection>({ text: '', from: 0, to: 0 });
  const loadedSectionId = useRef<string | null>(null);

  const contentBase = `/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`;

  const contentQuery = useQuery({
    queryKey: ['projects', projectId, 'content', sectionId],
    queryFn: () => api.get<SectionContentDto>(contentBase),
    enabled: Boolean(projectId && chapterId && sectionId),
  });

  const jobsQuery = useQuery({
    queryKey: ['projects', projectId, 'jobs'],
    queryFn: () => api.get<JobDto[]>(`/projects/${projectId}/jobs`),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((j) => j.queueName === 'content-generation' && ACTIVE_STATUSES.has(j.status)) ? 2000 : false;
    },
  });

  useEffect(() => {
    if (contentQuery.data && contentQuery.data.sectionId !== loadedSectionId.current) {
      setDraftContent(contentQuery.data.currentContent ?? '');
      setIsDirty(false);
      loadedSectionId.current = contentQuery.data.sectionId;
    }
  }, [contentQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put(`${contentBase}/manual`, { content: draftContent }),
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'content', sectionId] });
      toast({ title: 'Saved' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/content/chapters/${chapterId}/sections/${sectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'jobs'] });
      toast({ title: 'Regenerating with AI…' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not queue regeneration',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  // Once the AI regeneration job for this section completes, reload its content into the editor.
  const activeJob = (jobsQuery.data ?? []).find(
    (j) => j.queueName === 'content-generation' && j.sectionId === sectionId,
  );
  const prevJobStatus = useRef(activeJob?.status);
  useEffect(() => {
    if (prevJobStatus.current !== 'completed' && activeJob?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'content', sectionId] });
    }
    prevJobStatus.current = activeJob?.status;
  }, [activeJob?.status, projectId, queryClient, sectionId]);

  function applyAssistantResult(text: string, range: { from: number; to: number }) {
    if (!editor) return;
    if (range.from === range.to) {
      editor.commands.setContent(text);
    } else {
      editor.chain().focus().insertContentAt(range, text).run();
    }
    setDraftContent(editor.storage.markdown.getMarkdown());
    setIsDirty(true);
  }

  if (!projectId || !chapterId || !sectionId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to project
        </Link>
        <div className="flex items-center gap-2">
          {isDirty && <Badge variant="warning">unsaved changes</Badge>}
          {activeJob && ACTIVE_STATUSES.has(activeJob.status) && <Badge variant="secondary">regenerating…</Badge>}
          <Button
            size="sm"
            variant="outline"
            disabled={regenerateMutation.isPending || (activeJob && ACTIVE_STATUSES.has(activeJob.status))}
            onClick={() => regenerateMutation.mutate()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate with AI
          </Button>
          <Button size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[220px_1fr_360px] overflow-hidden">
        <div className="overflow-hidden border-r bg-card">
          <SectionNavigator projectId={projectId} activeChapterId={chapterId} activeSectionId={sectionId} />
        </div>

        <div className="overflow-hidden p-4">
          {contentQuery.isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <TiptapEditor
              content={draftContent}
              onChange={(markdown) => {
                setDraftContent(markdown);
                setIsDirty(true);
              }}
              onSelectionChange={setSelection}
              onEditorReady={setEditor}
            />
          )}
        </div>

        <div className="overflow-hidden border-l bg-card">
          <Tabs defaultValue="assistant" className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 grid grid-cols-3">
              <TabsTrigger value="assistant">Assistant</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="editing">Editing</TabsTrigger>
            </TabsList>
            <TabsContent value="assistant" className="mt-0 flex-1 overflow-hidden">
              <AiAssistantPanel
                projectId={projectId}
                chapterId={chapterId}
                sectionId={sectionId}
                selection={selection}
                onApplyResult={applyAssistantResult}
              />
            </TabsContent>
            <TabsContent value="versions" className="mt-0 flex-1 overflow-hidden">
              <VersionsPanel projectId={projectId} chapterId={chapterId} sectionId={sectionId} />
            </TabsContent>
            <TabsContent value="editing" className="mt-0 flex-1 overflow-hidden">
              <EditPassesPanel projectId={projectId} chapterId={chapterId} sectionId={sectionId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
