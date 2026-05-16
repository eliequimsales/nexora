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

/**
 * Data point para gráficos de tendência
 */
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
  label?: string;
}

/**
 * Estatísticas de canal (WhatsApp, Email, etc)
 */
export interface ChannelStats {
  channel: 'whatsapp' | 'email';
  sent: number;
  responded: number;
  successRate: number;
}

/**
 * Analytics completa para Nexora — inclui tendências, canais e insights
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
    recoveries: TrendPoint[]; // Recuperações por dia
    revenue: TrendPoint[]; // Receita estimada por dia
  };

  // Performance por canal
  channels: ChannelStats[];

  // Top insights (baseado em dados)
  insights: {
    bestDay: string; // Dia com mais recuperações
    bestChannel: 'whatsapp' | 'email';
    topMessage: string | null; // Template de mensagem mais efetivo
    avgTimeToReactivation: number; // Dias médios até resposta (estimate)
  };
}
