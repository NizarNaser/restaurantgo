import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChefHat, Loader2 } from 'lucide-react';
import { useAdminAuthStore } from '../../store/adminAuthStore';

export default function AdminLoginPage() {
  const { login, isLoading, error, isAuthenticated } = useAdminAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) navigate('/admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4" dir="rtl">
      <div className="w-full max-w-sm card p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-[var(--color-primary)] p-3 rounded-xl text-white mb-3">
            <ChefHat size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">لوحة تحكم الشركة</h1>
          <p className="text-sm text-gray-500 mt-1">لموظفي RestaurantGo فقط</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" required placeholder="البريد الإلكتروني" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required placeholder="كلمة المرور" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
