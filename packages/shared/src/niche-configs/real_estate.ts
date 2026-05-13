import type { NicheConfig } from './types';

export const realEstateConfig: NicheConfig = {
  niche: 'real_estate',

  pipelineStages: [
    {
      name: 'Novo Lead',
      position: 1,
      color: '#6B7280',
      stageType: 'active',
      isDefault: true,
    },
    {
      name: 'Em Contato',
      position: 2,
      color: '#3B82F6',
      stageType: 'active',
      isDefault: false,
    },
    {
      name: 'Visita Agendada',
      position: 3,
      color: '#8B5CF6',
      stageType: 'active',
      isDefault: false,
    },
    {
      name: 'Proposta Enviada',
      position: 4,
      color: '#F59E0B',
      stageType: 'active',
      isDefault: false,
    },
    {
      name: 'Fechado',
      position: 5,
      color: '#10B981',
      stageType: 'won',
      isDefault: false,
    },
    {
      name: 'Perdido',
      position: 6,
      color: '#EF4444',
      stageType: 'lost',
      isDefault: false,
    },
  ],

  leadFields: [
    {
      key: 'property_type',
      label: 'Tipo de imóvel',
      type: 'select',
      required: false,
      options: ['Apartamento', 'Casa', 'Terreno', 'Comercial', 'Outro'],
    },
    {
      key: 'property_interest',
      label: 'Interesse',
      type: 'select',
      required: false,
      options: ['Compra', 'Locação', 'Ambos'],
    },
    {
      key: 'budget_range',
      label: 'Faixa de orçamento',
      type: 'select',
      required: false,
      options: [
        'Até R$ 300 mil',
        'R$ 300 mil – R$ 600 mil',
        'R$ 600 mil – R$ 1 milhão',
        'Acima de R$ 1 milhão',
      ],
    },
    {
      key: 'neighborhood',
      label: 'Bairro / Região de interesse',
      type: 'text',
      required: false,
    },
  ],

  aiPrompts: {
    classify: `Você é um especialista em qualificação de leads imobiliários.

Analise os dados do lead abaixo e classifique seu potencial de compra.

DADOS DO LEAD:
- Nome: {{name}}
- Telefone: {{phone}}
- Email: {{email}}
- Tipo de imóvel: {{property_type}}
- Interesse: {{property_interest}}
- Orçamento: {{budget_range}}
- Bairro de interesse: {{neighborhood}}
- Origem: {{source}}

Retorne SOMENTE um JSON válido, sem markdown, sem explicações fora do JSON:
{
  "classification": "hot" | "warm" | "cold",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): orçamento definido, interesse claro, dados de contato completos
- warm (40-69): interesse presente mas orçamento vago ou dados incompletos
- cold (0-39): dados mínimos, sem orçamento, interesse genérico`,

    respond: `Você é um consultor imobiliário especializado e atencioso.

Escreva uma mensagem de boas-vindas personalizada para o lead abaixo.
A mensagem deve ser enviada por WhatsApp ou email.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de imóvel: {{property_type}}
- Interesse: {{property_interest}}
- Orçamento: {{budget_range}}
- Bairro de interesse: {{neighborhood}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: profissional mas acolhedor
- Tamanho: 3-4 parágrafos curtos
- Mencione o tipo de imóvel e bairro se informados
- Termine com uma pergunta aberta que incentive resposta
- Não invente informações que não estão nos dados
- Não mencione que é uma IA`,

    followUp: `Você é um consultor imobiliário fazendo follow-up com um cliente.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de imóvel: {{property_type}}
- Interesse: {{property_interest}}
- Orçamento: {{budget_range}}
- Bairro: {{neighborhood}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE DE ATIVIDADES:
{{activity_history}}

REGRAS:
- Tom: natural, não invasivo, genuinamente útil
- Tamanho: 2-3 parágrafos curtos
- Referencie o histórico para personalizar (não repita o que já foi dito)
- Se follow_up_count = 1, seja um pouco mais direto com uma oferta de ajuda concreta
- Não mencione que é uma IA
- Termine com pergunta ou oferta específica`,
  },

  labels: {
    leadSingular: 'Lead',
    leadPlural: 'Leads',
    nicheDisplayName: 'Imobiliária',
  },
};
