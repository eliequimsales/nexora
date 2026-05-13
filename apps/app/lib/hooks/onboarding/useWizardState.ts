'use client';

import { useState, useCallback } from 'react';
import { useUpdateOnboarding } from './useUpdateOnboarding';
import type { OrgResponse } from '@/types';

export const WIZARD_TOTAL_STEPS = 6;

export function useWizardState(org: OrgResponse) {
  const persistedStep = org.settings?.onboarding?.wizardStep ?? 1;
  const [step, setStep] = useState<number>(persistedStep);
  const update = useUpdateOnboarding();

  const goTo = useCallback(
    (next: number) => {
      setStep(next);
      update.mutate({ wizardStep: next });
    },
    [update],
  );

  const next = useCallback(() => {
    if (step < WIZARD_TOTAL_STEPS) goTo(step + 1);
  }, [step, goTo]);

  const back = useCallback(() => {
    if (step > 1) goTo(step - 1);
  }, [step, goTo]);

  const complete = useCallback(() => {
    update.mutate({ wizardCompleted: true, wizardStep: WIZARD_TOTAL_STEPS });
    setStep(WIZARD_TOTAL_STEPS);
  }, [update]);

  const dismiss = useCallback(() => {
    update.mutate({ dismissed: true });
  }, [update]);

  return { step, goTo, next, back, complete, dismiss, isSaving: update.isPending };
}
