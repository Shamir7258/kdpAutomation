import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUserDto, UpdateUserInput } from '@kdp/shared';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/features/auth/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';

export function UsersTab() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<AdminUserDto[]>('/admin/users'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateUserInput }) =>
      api.patch<AdminUserDto>(`/admin/users/${userId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'User updated' });
    },
    onError: (err) =>
      toast({
        variant: 'destructive',
        title: 'Could not update user',
        description: err instanceof ApiError ? err.message : 'Something went wrong.',
      }),
  });

  if (usersQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {usersQuery.data?.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No users found.
        </div>
      )}

      {usersQuery.data?.map((u) => {
        // Backend rejects self-demote/self-disable anyway; hiding the actions here avoids a
        // round-trip just to show the admin an error toast for something never allowed.
        const isSelf = u.id === currentUser?.id;
        return (
          <Card key={u.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.name}</span>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                  {u.disabled && <Badge variant="destructive">Disabled</Badge>}
                  {isSelf && <Badge variant="outline">You</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{u.email}</p>
                <p className="text-xs text-muted-foreground">
                  {u.projectCount} {u.projectCount === 1 ? 'project' : 'projects'} · joined{' '}
                  {new Date(u.createdAt).toLocaleDateString()}
                </p>
              </div>
              {!isSelf && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() =>
                      updateMutation.mutate({
                        userId: u.id,
                        input: { role: u.role === 'admin' ? 'user' : 'admin' },
                      })
                    }
                  >
                    {u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ userId: u.id, input: { disabled: !u.disabled } })}
                  >
                    {u.disabled ? 'Enable' : 'Disable'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
