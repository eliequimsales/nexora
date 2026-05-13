export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  orgId: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthOrg {
  id: string;
  name: string;
  slug: string;
  niche: string;
  status: string;
  createdAt: string;
}

export interface AuthState {
  user: AuthUser | null;
  org: AuthOrg | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Shape returned by POST /auth/login and POST /auth/register
export interface LoginResponse {
  access_token: string;
  user: AuthUser;
  organization: AuthOrg;
}

// Shape returned by GET /auth/me
export interface MeResponse {
  user: AuthUser;
  organization: AuthOrg;
}

// Shape returned by POST /auth/refresh
export interface RefreshResponse {
  access_token: string;
}
