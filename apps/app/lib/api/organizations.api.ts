import { apiClient } from './client';
import type { OrgResponse, UpdateOrgPayload, OnboardingSettings } from '@/types';

type UpdateOnboardingPayload = Pick<OnboardingSettings, 'wizardStep' | 'wizardCompleted' | 'dismissed'>;

export const organizationsApi = {
  me: () => apiClient.get<OrgResponse>('/organizations/me'),
  update: (data: UpdateOrgPayload) => apiClient.patch<OrgResponse>('/organizations/me', data),
  patchOnboarding: (data: UpdateOnboardingPayload) =>
    apiClient.patch<OrgResponse>('/organizations/current/onboarding', data),
};
