import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api/endpoints';
import { setAccessToken } from '@/lib/api/client';
import type { User } from '@/lib/api/types';

export interface AuthContextValue {
  user: User | null;
  isOwner: boolean;
  ready: boolean; // silent boot refresh finished
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Silent login on boot: if a valid refresh cookie exists, restore the session.
  useEffect(() => {
    let cancelled = false;
    api.auth
      .refresh()
      .then((data) => {
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isOwner: user?.role === 'Owner', ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
