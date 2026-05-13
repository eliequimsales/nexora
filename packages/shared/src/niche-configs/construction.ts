import type { NicheConfig } from './types';

export const constructionConfig: NicheConfig = {
  niche: 'construction',

  pipelineStages: [
    { name: 'Novo Contato', position: 1, color: '#6B7280', stageType: 'active', isDefault: true },
    { name: 'Visita Técnica', position: 2, color: '#3B82F6', stageType: 'active', isDefault: false },
    { name: 'Orçamento Elaborado', position: 3, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Proposta Apresentada', position: 4, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Contrato Assinado', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Desistiu', position: 6, color: '#EF4444', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    {
      key: 'service_type',
      label: 'Tipo de serviço',
      type: 'select',
      required: false,
      options: ['Reforma', 'Construção', 'Acabamento', 'Projeto Arquitetônico', 'Instalações', 'Outro'],
    },
    { key: 'property_size', label: 'Tamanho (m²)', type: 'text', required: false },
    {
      key: 'timeline',
      label: 'Prazo desejado',
      type: 'select',
      required: false,
      options: ['Urgente', '1-3 meses', '3-6 meses', 'Mais de 6 meses', 'Sem prazo definido'],
    },
    { key: 'budget', label: 'Orçamento disponível', type: 'currency', required: false },
  ],

  aiPrompts: {
    classify: `Você é um especialista em qualificação de leads para construção civil e reformas.

Analise os dados do contato abaixo e classifique seu potencial.

DADOS DO LEAD:
- Nome: {{name}}
- Telefone: {{phone}}
- Email: {{email}}
- Tipo de serviço: {{service_type}}
- Tamanho (m²): {{property_size}}
- Prazo desejado: {{timeline}}
- Orçamento disponível: {{budget}}
- Origem: {{source}}

Retorne SOMENTE um JSON válido, sem markdown:
{
  "classification": "hot" | "warm" | "cold",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): serviço definido, prazo claro, orçamento informado
- warm (40-69): interesse real mas prazo vago ou orçamento não informado
- cold (0-39): consulta inicial sem detalhes, prazo indefinido`,

    respond: `Você é um consultor de obras e reformas técnico mas acessível.

Escreva uma mensagem inicial para o contato abaixo.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de serviço: {{service_type}}
- Tamanho: {{property_size}}
- Prazo: {{timeline}}
- Orçamento: {{budget}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: profissional, confiante, técnico mas sem jargão excessivo
- Tamanho: 3-4 parágrafos curtos
- Mencione o tipo de serviço e proponha o próximo passo (visita técnica ou videochamada)
- Destaque brevemente um diferencial (prazo, qualidade, garantia)
- Não invente informações
- Não mencione que é uma IA`,

    followUp: `Você é um consultor de obras fazendo follow-up com um potencial cliente.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de serviço: {{service_type}}
- Prazo desejado: {{timeline}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE:
{{activity_history}}

REGRAS:
- Tom: respeitoso, sem pressão, orientado a solução
- Tamanho: 2-3 parágrafos curtos
- Se a visita técnica não foi agendada: proponha novamente com flexibilidade de horário
- Se orçamento foi enviado: pergunte sobre dúvidas técnicas
- Não mencione que é uma IA`,
  },

  labels: {
    leadSingular: 'Lead',
    leadPlural: 'Leads',
    nicheDisplayName: 'Construção Civil',
  },
};
