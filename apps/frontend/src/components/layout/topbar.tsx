import { LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">
        {user ? (
          <span>
            Signed in as <span className="font-medium text-foreground">{user.name}</span>
          </span>
        ) : null}
      </div>
      <Button variant="ghost" size="sm" onClick={() => void logout()}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </header>
  );
}
