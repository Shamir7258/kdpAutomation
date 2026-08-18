import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProjectSchema, BOOK_TYPE_IDS, type CreateProjectInput, type ProjectDto } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { BOOK_TYPE_LABELS } from './book-type-labels';
import { Plus } from 'lucide-react';

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { language: 'en', targetAudience: '' },
  });

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => api.post<ProjectDto>('/projects', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      toast({ title: 'Project created' });
      reset();
      setOpen(false);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Could not create project',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>Set the basics — you'll pick a specific idea after research.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" placeholder="e.g. 90-Day Fitness Journal" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bookType">Book type</Label>
            <Controller
              control={control}
              name="bookType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="bookType">
                    <SelectValue placeholder="Select a book type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOK_TYPE_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {BOOK_TYPE_LABELS[id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.bookType && <p className="text-xs text-destructive">{errors.bookType.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="niche">Niche / topic</Label>
            <Input id="niche" placeholder="e.g. fitness for beginners" {...register('niche')} />
            {errors.niche && <p className="text-xs text-destructive">{errors.niche.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="targetAudience">Target audience (optional)</Label>
            <Input id="targetAudience" placeholder="e.g. adults new to exercise" {...register('targetAudience')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
