import type { NicheConfig } from './types';

export const ecommerceSocialConfig: NicheConfig = {
  niche: 'ecommerce_social',

  pipelineStages: [
    { name: 'Novo Contato', position: 1, color: '#6B7280', stageType: 'active', isDefault: true },
    { name: 'Interesse Confirmado', position: 2, color: '#3B82F6', stageType: 'active', isDefault: false },
    { name: 'Orçamento Enviado', position: 3, color: '#8B5CF6', stageType: 'active', isDefault: false },
    { name: 'Aguardando Pagamento', position: 4, color: '#F59E0B', stageType: 'active', isDefault: false },
    { name: 'Pedido Confirmado', position: 5, color: '#10B981', stageType: 'won', isDefault: false },
    { name: 'Cancelado', position: 6, color: '#EF4444', stageType: 'lost', isDefault: false },
  ],

  leadFields: [
    {
      key: 'platform',
      label: 'Canal de origem',
      type: 'select',
      required: false,
      options: ['Instagram', 'WhatsApp', 'TikTok', 'Facebook', 'Marketplace', 'Site', 'Outro'],
    },
    { key: 'product_category', label: 'Categoria do produto', type: 'text', required: false },
    { key: 'order_value', label: 'Valor do pedido', type: 'currency', required: false },
  ],

  aiPrompts: {
    classify: `Você é um especialista em vendas pelo Instagram e e-commerce social.

Analise os dados do contato abaixo e classifique o potencial de compra.

DADOS DO CONTATO:
- Nome: {{name}}
- Canal: {{platform}}
- Categoria de produto: {{product_category}}
- Valor do pedido: {{order_value}}
- Email: {{email}}
- Origem: {{source}}

Retorne SOMENTE um JSON válido, sem markdown:
{
  "classification": "hot" | "warm" | "cold",
  "score": 0-100,
  "justification": "string com 1-2 frases explicando a classificação"
}

Critérios:
- hot (70-100): veio pelo canal certo, tem produto definido, valor informado
- warm (40-69): interesse confirmado mas sem detalhes de produto ou valor
- cold (0-39): contato inicial genérico, sem intenção clara`,

    respond: `Você é um atendente de loja online descontraído e eficiente.

Escreva uma mensagem de atendimento para o contato abaixo via {{platform}}.

DADOS DO CONTATO:
- Nome: {{name}}
- Canal: {{platform}}
- Produto de interesse: {{product_category}}
- Valor estimado: {{order_value}}
- Classificação IA: {{ai_classification}} (score: {{ai_score}})

REGRAS:
- Tom: amigável, próximo, linguagem de redes sociais (pode usar emojis com moderação)
- Tamanho: 2-3 parágrafos curtos
- Se hot: ofereça o próximo passo concreto (link, foto do produto, PIX)
- Se warm/cold: faça uma pergunta para entender melhor o interesse
- Não mencione que é uma IA`,

    followUp: `Você é um atendente de loja online fazendo follow-up com um cliente.

DADOS DO CONTATO:
- Nome: {{name}}
- Canal: {{platform}}
- Produto de interesse: {{product_category}}
- Número de follow-ups anteriores: {{follow_up_count}}

HISTÓRICO RECENTE:
{{activity_history}}

REGRAS:
- Tom: leve, sem pressão, mas direto
- Tamanho: 1-2 parágrafos
- Se follow_up_count = 1: pergunte se ainda tem interesse ou se surgiu alguma dúvida
- Nunca pareça desesperado para vender
- Não mencione que é uma IA`,
  },

  labels: {
    leadSingular: 'Contato',
    leadPlural: 'Contatos',
    nicheDisplayName: 'E-commerce / Social',
  },
};
