import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Route-level guard — until now, permission gating only ever hid a page's
 * nav link (see DashboardLayout), so anyone authenticated could still open
 * a gated page directly by URL. Wrap a sensitive route's element in this to
 * actually block it.
 */
export default function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  // A hard reload/direct link lands here with a valid token (isAuthenticated
  // true) before DashboardLayout's fetchUser() has resolved `user` — decide
  // nothing yet, or an authorized user gets bounced to /dashboard by a
  // permission check running against a still-empty user object.
  if (isAuthenticated && !user) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
