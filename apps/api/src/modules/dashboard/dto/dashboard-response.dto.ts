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

/**
 * Data point para gráficos de tendência
 */
export interface TrendPointDto {
  date: string; // YYYY-MM-DD
  value: number;
  label?: string;
}

/**
 * Estatísticas de canal (WhatsApp, Email, etc)
 */
export interface ChannelStatsDto {
  channel: 'whatsapp' | 'email';
  sent: number;
  responded: number;
  successRate: number;
}

/**
 * Analytics completa para a Nexora — inclui tendências, canais e insights
 */
export interface NexoraAnalyticsDto {
  // KPIs principais (snapshot atual)
  kpis: {
    inactiveCount: number;
    recoveredThisMonth: number;
    successRate: number;
    estimatedRevenue: number;
  };

  // Tendências por período (últimos 30 dias, por dia)
  trends: {
    recoveries: TrendPointDto[]; // Recuperações por dia
    revenue: TrendPointDto[]; // Receita estimada por dia
  };

  // Performance por canal
  channels: ChannelStatsDto[];

  // Top insights (baseado em dados)
  insights: {
    bestDay: string; // Dia com mais recuperações
    bestChannel: 'whatsapp' | 'email';
    topMessage: string | null; // Template de mensagem mais efetivo
    avgTimeToReactivation: number; // Dias médios até resposta (estimate)
  };
}

