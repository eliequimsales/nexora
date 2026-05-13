import type { NicheConfig } from './types';

export const genericSalesConfig: NicheConfig = {
  niche: 'generic_sales',

  pipelineStages: [
    { name: 'Novo Lead', position: 1, color: '#6B7280', stageType: 'active', isDefault: true },
    { name: 'Em Contato', position: 2, color: '#3B82F6', stageType: 'active', isDefault: false },
    { name: 'Apresentação', position: 3, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Proposta Enviada', position: 4, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Fechado', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Perdido', position: 6, color: '#EF4444', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    { key: 'budget', label: 'Orçamento', type: 'currency', required: false },
    { key: 'product_interest', label: 'Produto / Serviço de interesse', type: 'text', required: false },
    {
      key: 'how_met',
      label: 'Como nos conheceu',
      type: 'select',
      required: false,
      options: ['Instagram', 'Indicação', 'Google', 'WhatsApp', 'Site', 'Outro'],
    },
  ],

  aiPrompts: {
    classify: `Você é um especialista em qualificação de leads de vendas.

Analise os dados do lead abaixo e classifique seu potencial de compra.

DADOS DO LEAD:
- Nome: {{name}}
- Email: {{email}}
- Telefone: {{phone}}
- Produto / Serviço de interesse: {{product_interest}}
- Orçamento: {{budget}}
- Como nos conheceu: {{how_met}}
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

    respond: `Você é um consultor de vendas atencioso e profissional.

Escreva uma mensagem de boas-vindas personalizada para o lead abaixo.
A mensagem deve ser enviada por WhatsApp ou email.

DADOS DO LEAD:
- Nome: {{name}}
- Produto / Serviço de interesse: {{product_interest}}
- Orçamento: {{budget}}
- Como nos conheceu: {{how_met}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: profissional mas acolhedor
- Tamanho: 3-4 parágrafos curtos
- Mencione o produto ou serviço de interesse se informado
- Termine com uma pergunta aberta que incentive resposta
- Não invente informações que não estão nos dados
- Não mencione que é uma IA`,

    followUp: `Você é um consultor de vendas fazendo follow-up com um potencial cliente.

DADOS DO LEAD:
- Nome: {{name}}
- Produto / Serviço de interesse: {{product_interest}}
- Orçamento: {{budget}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE DE ATIVIDADES:
{{activity_history}}

REGRAS:
- Tom: natural, não invasivo, genuinamente útil
- Tamanho: 2-3 parágrafos curtos
- Referencie o histórico para personalizar
- Se follow_up_count = 1, seja mais direto com uma oferta de ajuda concreta
- Não mencione que é uma IA
- Termine com pergunta ou oferta específica`,
  },

  labels: {
    leadSingular: 'Lead',
    leadPlural: 'Leads',
    nicheDisplayName: 'Vendas Geral',
  },
};
