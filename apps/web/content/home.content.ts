export const homeContent = {
  hero: {
    label: 'Plataforma de automação com IA',
    headline: ['Sua operação', 'rodando.', 'Com inteligência.'],
    accentWord: 'Em escala.',
    subline:
      'B\'reshit centraliza leads, pipeline, mensagens, tarefas e automações numa plataforma onde a IA trabalha em cada etapa do fluxo comercial e operacional.',
    ctaPrimary: { label: 'Começar agora — é gratuito', href: '/cadastro' },
    ctaSecondary: { label: 'Ver como funciona', href: '#como-funciona' },
    socialProof: 'Sem cartão de crédito. Configuração em menos de 10 minutos.',
  },

  stats: [
    { value: '2.400+', label: 'organizações ativas' },
    { value: '94%', label: 'leads respondidos em < 5min com IA' },
    { value: '3,2×', label: 'mais conversões vs. operação manual' },
    { value: '47', label: 'integrações disponíveis' },
  ],

  howItWorks: {
    label: 'Como funciona',
    headline: 'Da captura ao fechamento.',
    headlineAccent: 'A IA cuida do caminho.',
    steps: [
      {
        number: '01',
        title: 'Capture',
        description:
          'Leads chegam por formulário, integração ou API. A IA classifica, pontua e organiza em segundos — antes de qualquer humano precisar intervir.',
      },
      {
        number: '02',
        title: 'Qualifique',
        description:
          'Nossos modelos analisam comportamento, histórico e contexto. Leads quentes sobem no pipeline automaticamente. Leads frios entram em fluxo de nutrição.',
      },
      {
        number: '03',
        title: 'Avance',
        description:
          'Mensagens personalizadas, propostas automáticas e follow-ups são disparados no momento certo, pelo canal certo, com o tom certo para cada nicho.',
      },
      {
        number: '04',
        title: 'Feche',
        description:
          'Sua equipe foca onde importa: leads prontos para decidir. O resto já foi resolvido.',
      },
    ],
  },

  modules: {
    label: 'Plataforma modular',
    headline: 'Uma plataforma.',
    headlineAccent: 'Cada módulo no lugar certo.',
    subline: 'Ative apenas o que você precisa. Escale conforme a operação cresce.',
    items: [
      {
        id: 'leads',
        icon: 'target',
        title: 'Leads',
        description: 'Captura inteligente e classificação automática de oportunidades.',
        tag: 'IA',
      },
      {
        id: 'pipeline',
        icon: 'kanban',
        title: 'Pipeline',
        description: 'Funil visual com movimentação assistida por IA.',
        tag: 'CRM',
      },
      {
        id: 'mensagens',
        icon: 'message-square',
        title: 'Mensagens',
        description: 'Omnichannel com resposta automatizada e escalada inteligente.',
        tag: 'Omnichannel',
      },
      {
        id: 'tarefas',
        icon: 'check-square',
        title: 'Tarefas',
        description: 'Gestão operacional conectada ao fluxo comercial.',
        tag: 'Operações',
      },
      {
        id: 'automacoes',
        icon: 'zap',
        title: 'Automações',
        description: 'Workflows que executam, aprendem e se adaptam.',
        tag: 'Workflows',
      },
      {
        id: 'ia',
        icon: 'brain',
        title: 'IA Central',
        description: 'O motor que une todos os módulos. Em tempo real.',
        tag: 'Core',
      },
      {
        id: 'propostas',
        icon: 'file-text',
        title: 'Propostas',
        description: 'Geração automática de orçamentos e documentos.',
        tag: 'Documentos',
      },
      {
        id: 'analytics',
        icon: 'bar-chart-2',
        title: 'Analytics',
        description: 'Métricas que orientam decisão, não decoram dashboard.',
        tag: 'Insights',
      },
    ],
  },

  finalCta: {
    headline: 'Sua operação',
    headlineAccent: 'começa agora.',
    subline:
      'Cadastre-se em menos de 2 minutos. Sem configuração complexa. Sem equipe de TI. A IA entra em produção no mesmo dia.',
    ctaPrimary: { label: 'Criar conta gratuita', href: '/cadastro' },
    ctaSecondary: { label: 'Falar com especialista', href: '/contato' },
  },
} as const;
