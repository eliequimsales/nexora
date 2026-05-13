'use client';

import { useQuery } from '@tanstack/react-query';
import { usersApi, type ListUsersParams } from '@/lib/api/users.api';

export const USERS_QUERY_KEY = (params?: ListUsersParams) =>
  ['users', params ?? {}] as const;

export function useUsersQuery(params?: ListUsersParams) {
  return useQuery({
    queryKey: USERS_QUERY_KEY(params),
    queryFn: () => usersApi.list(params).then((r) => r.data),
    staleTime: 30_000,
  });
}
