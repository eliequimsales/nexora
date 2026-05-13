export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  orgId: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface AuthOrgDto {
  id: string;
  name: string;
  slug: string;
  niche: string;
  status: string;
  formToken: string;
  settings: Record<string, unknown>;
  createdAt: Date;
}

export interface AuthResponseDto {
  access_token: string;
  user: AuthUserDto;
  organization: AuthOrgDto;
}

export interface RefreshResponseDto {
  access_token: string;
}
