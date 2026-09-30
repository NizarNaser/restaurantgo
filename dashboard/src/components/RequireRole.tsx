import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Route-level guard for pages restricted to management (owner/manager),
 * not tied to any one specific permission — the back-office pages (menu,
 * financials, HR, billing, settings, ...) that floor staff (waiter,
 * bartender, staff) have no business opening even by typing the URL
 * directly, unlike the day-to-day operational pages (Halls, Reservations,
 * Kitchen Display) any staff member can reach. See RequirePermission for
 * the narrower, capability-specific counterpart.
 */
export default function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasRole = useAuthStore((s) => s.hasRole);

  // Same race as RequirePermission: a hard reload/direct link arrives with
  // a valid token before fetchUser() has populated `user` — wait rather
  // than bounce an actually-authorized owner/manager to /dashboard.
  if (isAuthenticated && !user) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  if (!roles.some((role) => hasRole(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
