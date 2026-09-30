import { create } from 'zustand';
import api from '../api/axios';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number | null;
  roles: string[];
  permissions: string[];
}

interface AdminAuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('platform_auth_token'),
  isAuthenticated: !!localStorage.getItem('platform_auth_token'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      if (user.tenant_id !== null) {
        set({ error: 'This account does not have access to the company admin panel.', isLoading: false });
        return false;
      }

      localStorage.setItem('platform_auth_token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('platform_auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('platform_auth_token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),

  hasPermission: (permission: string) => get().user?.permissions?.includes(permission) ?? false,
}));
