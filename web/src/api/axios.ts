import axios from 'axios';

// Falls back to the current hostname (not a hardcoded 'localhost') so the
// site keeps working when opened from a phone via the dev machine's LAN IP,
// where 'localhost' would resolve to the phone itself.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Attach the platform-admin auth token to every request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('platform_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('platform_auth_token');
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
