export interface DashboardSummaryDto {
  leads: {
    total: number;
    new: number;
    qualified: number;
    hot: number;
  };
  tasks: {
    pending: number;
    overdue: number;
  };
  ai: {
    executionsToday: number;
    successToday: number;
    successRate: number;
  };
  members: number;
}

export interface ActivityItemDto {
  id: string;
  type: string;
  content: string;
  leadId: string;
  leadName: string;
  userId: string | null;
  userName: string | null;
  userAvatarUrl: string | null;
  createdAt: Date;
}

export interface DashboardActivityDto {
  items: ActivityItemDto[];
}
