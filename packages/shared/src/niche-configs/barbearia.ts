import type { NicheConfig } from './types';

export const barbeariaConfig: NicheConfig = {
  niche: 'barbearia',

  pipelineStages: [
    { name: 'Ativo', position: 1, color: '#10B981', stageType: 'active', isDefault: true },
    { name: 'Inativo 30d', position: 2, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Inativo 60d+', position: 3, color: '#EF4444', stageType: 'active', isDefault: false },
    { name: 'Mensagem Enviada', position: 4, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Voltou!', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Perdido', position: 6, color: '#6B7280', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    {
      key: 'last_service',
      label: 'Último serviço',
      type: 'select',
      required: false,
      options: ['Corte', 'Barba', 'Corte + Barba', 'Pigmentação', 'Sobrancelha', 'Relaxamento', 'Outro'],
    },
    {
      key: 'return_frequency',
      label: 'Frequência de retorno',
      type: 'select',
      required: false,
      options: ['Semanal', 'Quinzenal', '1 vez por mês', 'A cada 45 dias', 'Esporádico'],
    },
    { key: 'avg_ticket', label: 'Ticket médio (R$)', type: 'currency', required: false },
  ],

  aiPrompts: {
    classify: `Você é um especialista em retenção de clientes para barbearias.

Analise os dados do cliente abaixo e classifique se ele é recuperável.

DADOS DO CLIENTE:
- Nome: {{name}}
- Telefone: {{phone}}
- Último atendimento: {{last_visit_date}}
- Dias sem retorno: {{days_inactive}}
- Frequência habitual: {{return_frequency}}
- Último serviço: {{last_service}}
- Ticket médio: {{avg_ticket}}

Retorne SOMENTE um JSON válido, sem markdown:
{
  "classification": "hot" | "warm" | "cold" | "inactive",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): inativo há 30-45 dias, tinha frequência regular — alta chance de retorno
- warm (40-69): inativo há 45-60 dias, frequência irregular — retorno possível
- cold (0-39): inativo há 60+ dias ou nunca teve frequência regular
- inactive: qualquer cliente sem retorno há 30+ dias (padrão para detecção automática)`,

    respond: `Você é um barbeiro simpático e direto que quer reconquistar um cliente que sumiu.

Escreva uma mensagem de WhatsApp para o cliente abaixo. A mensagem deve parecer pessoal, como se o barbeiro estivesse mandando do próprio celular.

DADOS DO CLIENTE:
- Nome: {{name}}
- Dias sem retorno: {{days_inactive}}
- Último serviço: {{last_service}}
- Frequência habitual: {{return_frequency}}
- Classificação: {{ai_classification}} (score: {{ai_score}})

REGRAS OBRIGATÓRIAS:
- Comece com "Oi {{name}}," ou "E aí {{name}},"
- Mencione quantos dias/semanas faz que ele não aparece (seja específico)
- Tom: descontraído, amigável, sem pressão — como conversa de WhatsApp real
- Tamanho: máximo 4 linhas curtas
- Termine com uma pergunta simples para agendar (ex: "Quer marcar essa semana?")
- Pode usar 1 emoji no máximo, se ficar natural
- NÃO mencione que é uma IA
- NÃO use linguagem formal ou corporativa
- NÃO invente informações sobre promoções ou preços`,

    followUp: `Você é um barbeiro fazendo follow-up com um cliente que não respondeu à primeira mensagem.

DADOS DO CLIENTE:
- Nome: {{name}}
- Dias sem retorno: {{days_inactive}}
- Número de mensagens anteriores: {{follow_up_count}}
- Último serviço: {{last_service}}

HISTÓRICO:
{{activity_history}}

REGRAS:
- Tom: leve, sem cobrar nem pressionar — apenas reabrir a conversa
- Tamanho: 2-3 linhas máximo
- Se é o 1º follow-up: ofereça algo concreto (horário, facilidade)
- Se é o 2º follow-up: mensagem de despedida gentil, deixando a porta aberta
- NÃO mencione que é uma IA
- NÃO seja repetitivo — mude o ângulo da primeira mensagem`,
  },

  labels: {
    leadSingular: 'Cliente',
    leadPlural: 'Clientes',
    nicheDisplayName: 'Barbearia',
  },
};
