import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { READING_LEVELS, TRIM_SIZE_IDS, type BookIdeaDto, type BookSpecificationDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

export function CreateSpecificationDialog({
  projectId,
  idea,
  open,
  onOpenChange,
}: {
  projectId: string;
  idea: BookIdeaDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tone, setTone] = useState('conversational');
  const [readingLevel, setReadingLevel] = useState<(typeof READING_LEVELS)[number]>('general');
  const [trimSizeId, setTrimSizeId] = useState<(typeof TRIM_SIZE_IDS)[number]>('6x9');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.post<BookSpecificationDto>(`/projects/${projectId}/specification`, {
        ideaId: idea.id,
        tone,
        readingLevel,
        trimSizeId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'specification'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'ideas'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      toast({ title: 'Book specification created' });
      onOpenChange(false);
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not create specification',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create book specification</DialogTitle>
          <DialogDescription>Based on "{idea.title}". This becomes the canonical spec for the rest of the workflow.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tone">Tone</Label>
            <Input id="tone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. conversational" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="readingLevel">Reading level</Label>
            <Select value={readingLevel} onValueChange={(v) => setReadingLevel(v as typeof readingLevel)}>
              <SelectTrigger id="readingLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {READING_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trimSizeId">Trim size</Label>
            <Select value={trimSizeId} onValueChange={(v) => setTrimSizeId(v as typeof trimSizeId)}>
              <SelectTrigger id="trimSizeId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIM_SIZE_IDS.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size} in
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Creating…' : 'Create specification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
