import { useMutation } from '@tanstack/react-query';
import { billingApi } from '@/lib/api/billing.api';

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (priceId: string) => billingApi.createCheckout(priceId).then((r) => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}
