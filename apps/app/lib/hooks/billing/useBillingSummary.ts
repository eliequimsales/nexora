import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api/billing.api';

export const BILLING_QUERY_KEY = ['billing', 'summary'];

export function useBillingSummary() {
  return useQuery({
    queryKey: BILLING_QUERY_KEY,
    queryFn: () => billingApi.getSummary().then((r) => r.data),
    staleTime: 30_000,
  });
}
