import type { NicheConfig } from './types';

export const professionalServicesConfig: NicheConfig = {
  niche: 'professional_services',

  pipelineStages: [
    { name: 'Novo Lead', position: 1, color: '#6B7280', stageType: 'active', isDefault: true },
    { name: 'Diagnóstico', position: 2, color: '#3B82F6', stageType: 'active', isDefault: false },
    { name: 'Proposta Elaborada', position: 3, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Negociação', position: 4, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Contrato Assinado', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Perdido', position: 6, color: '#EF4444', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    { key: 'service_type', label: 'Tipo de serviço', type: 'text', required: false },
    {
      key: 'company_size',
      label: 'Porte da empresa',
      type: 'select',
      required: false,
      options: ['MEI', 'Pequena (até 50 func.)', 'Média (50-500 func.)', 'Grande (500+ func.)', 'Pessoa Física'],
    },
    {
      key: 'urgency',
      label: 'Urgência',
      type: 'select',
      required: false,
      options: ['Imediato', 'Em até 1 mês', 'Em até 3 meses', 'Sem prazo definido'],
    },
    { key: 'budget', label: 'Orçamento', type: 'currency', required: false },
  ],

  aiPrompts: {
    classify: `Você é um especialista em qualificação de leads para serviços profissionais (consultoria, advocacia, contabilidade, coaching, educação).

Analise os dados do lead abaixo e classifique seu potencial.

DADOS DO LEAD:
- Nome: {{name}}
- Email: {{email}}
- Telefone: {{phone}}
- Tipo de serviço: {{service_type}}
- Porte da empresa: {{company_size}}
- Urgência: {{urgency}}
- Orçamento: {{budget}}
- Origem: {{source}}

Retorne SOMENTE um JSON válido, sem markdown:
{
  "classification": "hot" | "warm" | "cold",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): necessidade clara, urgência definida, porte compatível com o serviço, orçamento informado
- warm (40-69): interesse real mas urgência vaga ou orçamento não informado
- cold (0-39): pesquisa inicial de mercado, sem necessidade definida`,

    respond: `Você é um consultor profissional experiente e confiável.

Escreva uma mensagem inicial para o lead abaixo.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de serviço: {{service_type}}
- Porte da empresa: {{company_size}}
- Urgência: {{urgency}}
- Orçamento: {{budget}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: formal mas acessível, orientado a resultados e valor entregue
- Tamanho: 3-4 parágrafos curtos
- Demonstre entendimento do problema e posicione sua expertise
- Proponha uma reunião de diagnóstico (gratuita ou paga conforme o caso)
- Não invente informações
- Não mencione que é uma IA`,

    followUp: `Você é um consultor profissional fazendo follow-up com um potencial cliente.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de serviço: {{service_type}}
- Porte: {{company_size}}
- Urgência: {{urgency}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE:
{{activity_history}}

REGRAS:
- Tom: respeitoso, direto, orientado ao valor
- Tamanho: 2-3 parágrafos curtos
- Se diagnóstico não foi feito: reforce o benefício de começar logo
- Se proposta foi enviada: pergunte sobre dúvidas específicas
- Não mencione que é uma IA`,
  },

  labels: {
    leadSingular: 'Lead',
    leadPlural: 'Leads',
    nicheDisplayName: 'Serviços Profissionais',
  },
};
