import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// Reached from the company admin panel's "open dashboard" action on a tenant
// (see web/src/pages/admin/TenantsPage.tsx), which opens this URL with a
// one-time impersonation token issued by POST /admin/tenants/{id}/impersonate.
export default function ImpersonatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginWithToken = useAuthStore((s) => s.loginWithToken);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(true);
      return;
    }

    // Strip the token from the address bar immediately so it doesn't linger
    // in browser history, then load the impersonated user's session.
    window.history.replaceState({}, '', '/impersonate');

    loginWithToken(token)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setError(true));
  }, [searchParams, loginWithToken, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        تعذر تسجيل الدخول، الرابط غير صالح أو منتهي الصلاحية.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}
