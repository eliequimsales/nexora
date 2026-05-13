export type AnalyticsPeriod = '7d' | '30d' | '90d';

export interface AnalyticsSummary {
  period: { from: string; to: string };
  leads: {
    total: number;
    new: number;
    qualified: number;
    closedWon: number;
    closedLost: number;
    hot: number;
    warm: number;
    cold: number;
    unclassified: number;
  };
  proposals: {
    total: number;
    sent: number;
    viewed: number;
    accepted: number;
    rejected: number;
    acceptanceRate: number;
    totalAcceptedRevenue: number;
  };
  ai: {
    executionsTotal: number;
    executionsSuccess: number;
    executionsFailed: number;
    successRate: number;
  };
  workflows: {
    executionsTotal: number;
    executionsSuccess: number;
    executionsFailed: number;
    successRate: number;
  };
}

export interface FunnelStage {
  stageId: string;
  stageName: string;
  stageType: string;
  color: string;
  position: number;
  count: number;
}

export interface ProposalStats {
  byStatus: { status: string; count: number; totalAmount: number }[];
  avgAcceptedAmount: number;
  avgResponseDays: number | null;
}

export interface AiStats {
  byActionType: {
    actionType: string;
    total: number;
    success: number;
    failed: number;
    successRate: number;
  }[];
  tokensUsed: number;
}
