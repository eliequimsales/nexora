export interface DashboardSummary {
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

export interface ActivityItem {
  id: string;
  type: string;
  content: string;
  leadId: string;
  leadName: string;
  userId: string | null;
  userName: string | null;
  userAvatarUrl: string | null;
  createdAt: string;
}

export interface DashboardActivity {
  items: ActivityItem[];
}

/**
 * Métricas de Nexora — recuperação de clientes.
 */
export interface NexoraMetricsDto {
  recovery: {
    inactiveCount: number; // Clientes sem atividade há 30+ dias
    recoveredToday: number; // Recuperações tentadas hoje
    recoveredThisMonth: number; // Total este mês
    successRate: number; // % de respostas (0-100)
    estimatedRevenue: number; // R$ 80 × count
  };
}
