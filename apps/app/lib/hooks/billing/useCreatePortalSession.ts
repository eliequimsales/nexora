import { useMutation } from '@tanstack/react-query';
import { billingApi } from '@/lib/api/billing.api';

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => billingApi.createPortal().then((r) => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}
