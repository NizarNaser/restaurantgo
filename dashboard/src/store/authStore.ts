import { create } from 'zustand';
import api from '../api/axios';

interface User {
  id: number;
  name: string;
  email: string;
  tenant_id: number | null;
  locale: string;
  timezone: string;
  avatar: string | null;
  permissions?: string[];
  roles?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      localStorage.setItem('auth_token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  loginWithToken: async (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
    await get().fetchUser();
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('auth_token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),

  hasPermission: (permission: string) => get().user?.permissions?.includes(permission) ?? false,
  hasRole: (role: string) => get().user?.roles?.includes(role) ?? false,
}));
