import axios from 'axios';
import i18n from '../i18n';

// Falls back to the current hostname (not a hardcoded 'localhost') so the
// dashboard keeps working when opened from a phone via the dev machine's LAN
// IP, where 'localhost' would resolve to the phone itself.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Attach the auth token and the admin's chosen dashboard language to every
// request. Without Accept-Language, the API falls back to resolving content
// locale from the browser's own language rather than what the admin picked
// in the dashboard's language switcher — showing e.g. a menu item's name in
// whatever locale the browser happens to default to, independent of the
// admin's actual UI language choice.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Accept-Language'] = i18n.language;
  return config;
});

// Handle 401 globally (redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
