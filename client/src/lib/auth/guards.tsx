import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/** Redirects unauthenticated users to /login, preserving the intended path. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Renders children only for Owners; otherwise shows a 403 message. */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { isOwner } = useAuth();
  if (!isOwner) {
    return (
      <div className="p-8">
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground">This area is restricted to the Owner.</p>
      </div>
    );
  }
  return <>{children}</>;
}
