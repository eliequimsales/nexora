import { apiClient } from './client';
import type { LoginResponse, MeResponse } from '@/types';

interface LoginPayload {
  email: string;
  password: string;
  slug?: string; // opcional — backend resolve automaticamente
}

interface RegisterPayload {
  name?: string; // opcional — usa orgName como fallback
  email: string;
  password: string;
  orgName: string;
  niche?: string; // opcional — default 'barbearia'
}

export const authApi = {
  register(payload: RegisterPayload) {
    return apiClient.post<LoginResponse>('/auth/register', payload);
  },

  login(payload: LoginPayload) {
    return apiClient.post<LoginResponse>('/auth/login', payload);
  },

  me() {
    return apiClient.get<MeResponse>('/auth/me');
  },

  logout() {
    return apiClient.post<void>('/auth/logout');
  },

  // Called internally by the axios interceptor — not used directly in UI
  refresh() {
    return apiClient.post<{ access_token: string }>('/auth/refresh');
  },
};
