import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatePromptTemplateInput, PromptTemplateDto, UpdatePromptTemplateInput } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

interface FormState {
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string;
  active: boolean;
}

function toFormState(template?: PromptTemplateDto): FormState {
  return {
    name: template?.name ?? '',
    description: template?.description ?? '',
    systemPrompt: template?.systemPrompt ?? '',
    userPrompt: template?.userPrompt ?? '',
    variables: template?.variables.join(', ') ?? '',
    active: template?.active ?? true,
  };
}

interface TemplateFormDialogProps {
  /** Present → editing that template; absent → creating a new one. */
  template?: PromptTemplateDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateFormDialog({ template, open, onOpenChange }: TemplateFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(template);
  const [form, setForm] = useState<FormState>(() => toFormState(template));

  useEffect(() => {
    if (open) setForm(toFormState(template));
  }, [open, template]);

  const mutation = useMutation({
    mutationFn: () => {
      const variables = splitList(form.variables);
      if (template) {
        const input: UpdatePromptTemplateInput = {
          description: form.description,
          systemPrompt: form.systemPrompt,
          userPrompt: form.userPrompt,
          variables,
          active: form.active,
        };
        return api.patch<PromptTemplateDto>(`/prompt-templates/${template.id}`, input);
      }
      const input: CreatePromptTemplateInput = {
        name: form.name,
        description: form.description,
        systemPrompt: form.systemPrompt,
        userPrompt: form.userPrompt,
        variables,
      };
      return api.post<PromptTemplateDto>('/prompt-templates', input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] });
      toast({ title: isEditing ? 'Template updated' : 'Template created' });
      onOpenChange(false);
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: isEditing ? 'Could not update template' : 'Could not create template',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit template' : 'New template'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Saving bumps the template version automatically.'
              : 'Define a new AI prompt template. The name must be unique.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-description">Description</Label>
            <Input
              id="tpl-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-system-prompt">System prompt</Label>
            <Textarea
              id="tpl-system-prompt"
              rows={5}
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-user-prompt">User prompt</Label>
            <Textarea
              id="tpl-user-prompt"
              rows={5}
              value={form.userPrompt}
              onChange={(e) => setForm({ ...form, userPrompt: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-variables">Variables, comma-separated</Label>
            <Input
              id="tpl-variables"
              placeholder="e.g. niche, targetAudience"
              value={form.variables}
              onChange={(e) => setForm({ ...form, variables: e.target.value })}
            />
          </div>
          {isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="tpl-active">Status</Label>
              <Select
                value={form.active ? 'active' : 'inactive'}
                onValueChange={(v) => setForm({ ...form, active: v === 'active' })}
              >
                <SelectTrigger id="tpl-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Create template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
