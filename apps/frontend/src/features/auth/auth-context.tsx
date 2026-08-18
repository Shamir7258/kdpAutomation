import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@kdp/shared';
import { api, setAccessToken, setUnauthorizedHandler } from '@/lib/api-client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDto | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    // Silent session restore on load, using the httpOnly refresh cookie.
    api
      .post<AuthResponse>('/auth/refresh', undefined, { skipAuthRetry: true })
      .then((data) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        setStatus('unauthenticated');
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(input) {
        const data = await api.post<AuthResponse>('/auth/login', input, { skipAuthRetry: true });
        setAccessToken(data.accessToken);
        setUser(data.user);
        setStatus('authenticated');
      },
      async register(input) {
        const data = await api.post<AuthResponse>('/auth/register', input, { skipAuthRetry: true });
        setAccessToken(data.accessToken);
        setUser(data.user);
        setStatus('authenticated');
      },
      async logout() {
        await api.post('/auth/logout').catch(() => undefined);
        setAccessToken(null);
        setUser(null);
        setStatus('unauthenticated');
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
