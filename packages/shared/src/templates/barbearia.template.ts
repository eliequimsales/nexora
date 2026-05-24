import { barbeariaConfig } from '../niche-configs/barbearia';
import type { TemplateDefinition } from './types';

export const barbeariaTemplate: TemplateDefinition = {
  id: 'barbearia_v1',
  name: 'Barbearia — Recuperação de Clientes',
  description: 'Pipeline e automações para barbearias: detecção de clientes inativos, geração de mensagens de reativação personalizadas e rastreamento de retorno.',
  niche: 'barbearia',
  version: '1.0.0',

  pipelineStages: barbeariaConfig.pipelineStages,
  aiPrompts: barbeariaConfig.aiPrompts,

  workflows: [
    {
      name: 'Detectar cliente inativo (30d)',
      description: 'Classifica automaticamente todo cliente sem retorno há 30+ dias.',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionType: 'ai_classify',
      actionConfig: { promptKey: 'classify' },
    },
    {
      name: 'Gerar mensagem de reativação',
      description: 'Gera mensagem personalizada de WhatsApp quando cliente é classificado como inativo.',
      triggerType: 'lead_classified',
      triggerConditions: { classification: 'inactive' },
      actionType: 'ai_respond',
      actionConfig: { promptKey: 'respond' },
    },
    {
      name: 'Follow-up para cliente sem resposta',
      description: 'Cria tarefa de follow-up 7 dias após mensagem enviada sem retorno.',
      triggerType: 'lead_stage_changed',
      triggerConditions: { stage: 'Mensagem Enviada' },
      actionType: 'create_task',
      actionConfig: { title: 'Follow-up: cliente ainda não respondeu', dueDaysFromNow: 7 },
    },
  ],
};
