'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/organizations.api';
import { ORG_QUERY_KEY } from '@/lib/hooks/org/useOrgQuery';
import type { OnboardingSettings } from '@/types';

type UpdateOnboardingPayload = Pick<OnboardingSettings, 'wizardStep' | 'wizardCompleted' | 'dismissed'>;

export function useUpdateOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateOnboardingPayload) =>
      organizationsApi.patchOnboarding(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEY });
    },
  });
}
