export interface PlanLimits {
  leadsPerMonth: number;
  aiExecPerMonth: number;
  maxUsers: number;
}

export interface BillingSummary {
  plan: string | null;
  status: string | null;
  currentPeriodEnd: string | null; // ISO 8601 date string
  limits: PlanLimits | null;
  usage: {
    leadsThisMonth: number;
    aiExecThisMonth: number;
    usersCount: number;
  };
}

export interface CheckoutSessionResponse {
  url: string | null;
}
