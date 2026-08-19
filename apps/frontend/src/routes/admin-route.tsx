import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';

/** Nested inside ProtectedRoute (so `status === 'authenticated'` and `user` are already
 *  guaranteed) — this only adds the role check. The backend enforces this for real; this is
 *  just so a non-admin never sees the admin UI flash before a redirect. */
export function AdminRoute() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
