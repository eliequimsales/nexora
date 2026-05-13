import type { NicheConfig } from './types';

export const beautyWellnessConfig: NicheConfig = {
  niche: 'beauty_wellness',

  pipelineStages: [
    { name: 'Novo Contato', position: 1, color: '#6B7280', stageType: 'active', isDefault: true },
    { name: 'Consulta Agendada', position: 2, color: '#EC4899', stageType: 'active', isDefault: false },
    { name: 'Avaliação Realizada', position: 3, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Plano de Tratamento', position: 4, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Cliente Ativo', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Inativo', position: 6, color: '#EF4444', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    {
      key: 'service_interest',
      label: 'Serviço de interesse',
      type: 'select',
      required: false,
      options: ['Estética Facial', 'Estética Corporal', 'Cabelo', 'Unhas', 'Massagem', 'Depilação', 'Maquiagem', 'Outro'],
    },
    {
      key: 'frequency',
      label: 'Frequência desejada',
      type: 'select',
      required: false,
      options: ['Pontual (1x)', 'Mensal', 'Quinzenal', 'Semanal'],
    },
    { key: 'budget', label: 'Investimento mensal', type: 'currency', required: false },
  ],

  aiPrompts: {
    classify: `Você é um especialista em qualificação de clientes para serviços de beleza e bem-estar.

Analise os dados do contato abaixo e classifique seu potencial.

DADOS DO LEAD:
- Nome: {{name}}
- Telefone: {{phone}}
- Serviço de interesse: {{service_interest}}
- Frequência desejada: {{frequency}}
- Investimento mensal: {{budget}}
- Origem: {{source}}

Retorne SOMENTE um JSON válido, sem markdown:
{
  "classification": "hot" | "warm" | "cold",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): serviço definido, frequência regular desejada, orçamento informado
- warm (40-69): interesse presente mas frequência pontual ou sem orçamento
- cold (0-39): consulta apenas de preço, sem intenção clara`,

    respond: `Você é uma profissional de beleza e bem-estar acolhedora e empática.

Escreva uma mensagem de boas-vindas para o contato abaixo.

DADOS DO LEAD:
- Nome: {{name}}
- Serviço de interesse: {{service_interest}}
- Frequência desejada: {{frequency}}
- Investimento: {{budget}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: acolhedor, empático, focado em autoestima e bem-estar
- Tamanho: 3-4 parágrafos curtos
- Mencione o serviço de interesse e como ele pode transformar a vida dela/dele
- Proponha agendamento de consulta ou avaliação gratuita
- Não invente informações
- Não mencione que é uma IA`,

    followUp: `Você é uma profissional de beleza fazendo follow-up com um potencial cliente.

DADOS DO LEAD:
- Nome: {{name}}
- Serviço de interesse: {{service_interest}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE:
{{activity_history}}

REGRAS:
- Tom: gentil, sem pressão, orientado ao cuidado pessoal
- Tamanho: 2-3 parágrafos curtos
- Se consulta não foi agendada: reforce o benefício do serviço e facilite o agendamento
- Se avaliação foi feita: pergunte sobre dúvidas do plano de tratamento
- Não mencione que é uma IA`,
  },

  labels: {
    leadSingular: 'Cliente',
    leadPlural: 'Clientes',
    nicheDisplayName: 'Beleza & Bem-estar',
  },
};
