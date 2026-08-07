import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.store';

const DEFAULT_API_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;

const getBaseURL = (): string => {
  const envBase = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: DEFAULT_API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof config.timeout !== 'number') {
    config.timeout = DEFAULT_API_TIMEOUT_MS;
  } else if (config.timeout > MAX_TIMEOUT_MS) {
    config.timeout = MAX_TIMEOUT_MS;
  }
  // Let axios auto-detect Content-Type for FormData (multipart/form-data)
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const base = getBaseURL();
          const { data } = await axios.post(`${base}/auth/refresh`, { refreshToken }, {
            timeout: 15_000,
          });
          useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          error.config.baseURL = getBaseURL();
          return axios(error.config as AxiosRequestConfig);
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
