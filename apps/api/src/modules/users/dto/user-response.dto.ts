import type { User } from '@nexora/api-prisma';

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function mapUser(user: User): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
