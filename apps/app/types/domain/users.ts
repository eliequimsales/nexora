export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UpdateUserPayload {
  role?: 'admin' | 'member';
  status?: 'active' | 'inactive';
}

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string;
}

export interface InviteUserPayload {
  email: string;
  role: 'admin' | 'member';
}
