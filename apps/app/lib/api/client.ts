import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/lib/stores/auth.store';
import { usePlanLimitStore } from '@/lib/stores/plan-limit.store';

// URL relativa: Next.js rewrite proxia /api/* → backend.
// Mantem cookie de auth no mesmo dominio do App (resolve cross-domain).
// Em dev (sem rewrite), fallback pra URL absoluta do backend.
const isBrowser = typeof window !== 'undefined';
const API_URL = isBrowser
  ? '' // browser: usa /api/v1 (mesmo dominio via rewrite)
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // required: sends httpOnly refresh_token cookie
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000, // 15s — evita loading infinito em mobile com conexão ruim
});

// ── Request interceptor: attach access token ──────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 with token refresh ───────────────────
// Single refresh promise — prevents race condition when multiple requests
// fail simultaneously with 401.
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 402 Plan Limit globally
    if (error.response?.status === 402) {
      const resource = (error.response.data as any)?.resource ?? 'resource';
      usePlanLimitStore.getState().open(resource);
      return Promise.reject(error);
    }

    // Only attempt refresh once per request, and only on 401
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Não tentar refresh nos próprios endpoints de auth — evita loop infinito.
    // /auth/me PODE tentar refresh (é o caso mobile: token perdeu da memória,
    // mas o refresh_token cookie ainda é válido).
    const isRefreshOrLogin =
      original.url?.includes('/auth/refresh') ||
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/register');
    if (isRefreshOrLogin) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = apiClient
          .post<{ access_token: string }>('/auth/refresh')
          .then((res) => {
            const token = res.data.access_token;
            useAuthStore.getState().setAccessToken(token);
            return token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    } catch {
      // Refresh failed — clear auth state and let the app redirect to login
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }
  }
);
