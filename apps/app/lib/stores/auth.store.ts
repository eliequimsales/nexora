import { create } from 'zustand';
import type { AuthUser, AuthOrg } from '@/types';

interface AuthStore {
  user: AuthUser | null;
  org: AuthOrg | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (payload: { user: AuthUser; org: AuthOrg; accessToken: string }) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  org: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true, // starts as true — AuthProvider resolves it

  setAuth({ user, org, accessToken }) {
    set({ user, org, accessToken, isAuthenticated: true, isLoading: false });
  },

  setAccessToken(accessToken) {
    set({ accessToken });
  },

  clearAuth() {
    set({
      user: null,
      org: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading(isLoading) {
    set({ isLoading });
  },
}));
