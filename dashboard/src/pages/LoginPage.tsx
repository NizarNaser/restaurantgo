import React, { useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('owner@demo.com');
  const [password, setPassword] = useState('password');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(email, password);
    if (success) {
      const isKitchenDisplay = useAuthStore.getState().user?.roles?.includes('kitchen_display');
      navigate(isKitchenDisplay ? '/kds' : '/dashboard');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-[#ff4757] p-3 rounded-xl text-white mb-4 shadow-lg shadow-red-200">
        <ChefHat size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('login.welcomeBack')}</h2>
      <p className="text-gray-500 mb-8 text-center">{t('login.subtitle')}</p>

      {error && (
        <div className="w-full mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      <form className="w-full space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.email')}</label>
          <input
            type="email"
            className="input w-full"
            placeholder="owner@restaurant.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.password')}</label>
          <input
            type="password"
            className="input w-full"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="rounded border-gray-300 text-red-500 focus:ring-red-500" />
            <span className="text-sm text-gray-600">{t('login.rememberMe')}</span>
          </label>
          <a href="#" className="text-sm font-medium text-red-500 hover:text-red-600">{t('login.forgotPassword')}</a>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full py-2.5 text-base mt-4 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('login.signingIn')}
            </>
          ) : (
            t('login.signIn')
          )}
        </button>
      </form>

      <div className="mt-6">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
