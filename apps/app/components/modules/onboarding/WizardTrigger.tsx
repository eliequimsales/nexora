'use client';

import { useOrgQuery } from '@/lib/hooks/org/useOrgQuery';
import { useAuth } from '@/lib/hooks/auth/useAuth';
import { WizardModal } from './WizardModal';

export function WizardTrigger() {
  const { data: org } = useOrgQuery();
  const { user } = useAuth();

  if (!org || !user) return null;

  const onboarding = org.settings?.onboarding;
  const isComplete = onboarding?.wizardCompleted === true;
  const isDismissed = onboarding?.dismissed === true;

  if (isComplete || isDismissed) return null;

  return <WizardModal org={org} userName={user.name} />;
}
