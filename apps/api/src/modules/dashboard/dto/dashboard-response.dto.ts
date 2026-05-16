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

/**
 * Métricas específicas da Nexora — foco em recuperação de clientes.
 * Usada para substituir o dashboard genérico quando a org está em modo Nexora.
 */
export interface NexoraMetricsDto {
  recovery: {
    inactiveCount: number; // Clientes sem atividade há 30+ dias
    recoveredToday: number; // Recuperações tentadas/bem-sucedidas hoje
    recoveredThisMonth: number; // Total este mês
    successRate: number; // % de mensagens que geraram resposta
    estimatedRevenue: number; // R$ 80 × count (ticket médio barbearia)
  };
}

