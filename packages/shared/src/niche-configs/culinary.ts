import type { NicheConfig } from './types';

export const culinaryConfig: NicheConfig = {
  niche: 'culinary',

  pipelineStages: [
    { name: 'Novo Contato', position: 1, color: '#6B7280', stageType: 'active', isDefault: true },
    { name: 'Degustação / Consulta', position: 2, color: '#3B82F6', stageType: 'active', isDefault: false },
    { name: 'Cardápio Definido', position: 3, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Proposta Enviada', position: 4, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Contrato Fechado', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Cancelado', position: 6, color: '#EF4444', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    {
      key: 'event_type',
      label: 'Tipo de evento / serviço',
      type: 'select',
      required: false,
      options: ['Casamento', 'Aniversário', 'Corporativo', 'Chá de bebê / revelação', 'Confraternização', 'Delivery recorrente', 'Outro'],
    },
    { key: 'guest_count', label: 'Número de pessoas', type: 'number', required: false },
    { key: 'event_date', label: 'Data do evento', type: 'text', required: false },
    { key: 'budget', label: 'Orçamento', type: 'currency', required: false },
  ],

  aiPrompts: {
    classify: `Você é um especialista em qualificação de clientes para serviços gastronômicos.

Analise os dados do contato abaixo e classifique seu potencial.

DADOS DO LEAD:
- Nome: {{name}}
- Telefone: {{phone}}
- Tipo de evento: {{event_type}}
- Número de pessoas: {{guest_count}}
- Data do evento: {{event_date}}
- Orçamento: {{budget}}
- Origem: {{source}}

Retorne SOMENTE um JSON válido, sem markdown:
{
  "classification": "hot" | "warm" | "cold",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): data definida, número de pessoas informado, orçamento claro
- warm (40-69): data ou número de pessoas vago, orçamento não informado
- cold (0-39): apenas curiosidade inicial, sem data ou detalhes`,

    respond: `Você é um chef ou atendente de serviço gastronômico caloroso e apaixonado por comida.

Escreva uma mensagem de boas-vindas para o contato abaixo.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de evento: {{event_type}}
- Número de pessoas: {{guest_count}}
- Data: {{event_date}}
- Orçamento: {{budget}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: caloroso, entusiasmado com gastronomia, pessoal
- Tamanho: 3-4 parágrafos curtos
- Mencione o tipo de evento e demonstre que entende a ocasião
- Proponha próximo passo: degustação, videochamada ou envio de cardápio
- Não invente informações
- Não mencione que é uma IA`,

    followUp: `Você é um chef fazendo follow-up com um potencial cliente.

DADOS DO LEAD:
- Nome: {{name}}
- Tipo de evento: {{event_type}}
- Data do evento: {{event_date}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE:
{{activity_history}}

REGRAS:
- Tom: amigável, sem pressão, focado na experiência do cliente
- Tamanho: 2-3 parágrafos curtos
- Se data próxima: crie senso de urgência sutil (disponibilidade de agenda)
- Se degustação não foi feita: convide novamente de forma acolhedora
- Não mencione que é uma IA`,
  },

  labels: {
    leadSingular: 'Cliente',
    leadPlural: 'Clientes',
    nicheDisplayName: 'Gastronomia',
  },
};
