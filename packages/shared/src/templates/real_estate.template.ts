import { realEstateConfig } from '../niche-configs/real_estate';
import type { TemplateDefinition } from './types';

export const realEstateTemplate: TemplateDefinition = {
  id: 'real_estate_v1',
  name: 'Imobiliária',
  description: 'Pipeline e automações para imobiliárias: qualificação de leads, respostas automáticas e follow-up inteligente.',
  niche: 'real_estate',
  version: '1.0.0',

  pipelineStages: realEstateConfig.pipelineStages,
  aiPrompts: realEstateConfig.aiPrompts,

  workflows: [
    {
      name: 'Classificar novo lead',
      description: 'Classifica automaticamente todo lead recém-criado com IA.',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionType: 'ai_classify',
      actionConfig: { promptKey: 'classify' },
    },
    {
      name: 'Responder lead qualificado',
      description: 'Envia mensagem personalizada quando lead é classificado como hot ou warm.',
      triggerType: 'lead_classified',
      triggerConditions: {},
      actionType: 'ai_respond',
      actionConfig: { promptKey: 'respond' },
    },
    {
      name: 'Criar tarefa de follow-up',
      description: 'Cria tarefa de acompanhamento ao mover lead para "Em Contato".',
      triggerType: 'lead_stage_changed',
      triggerConditions: {},
      actionType: 'create_task',
      actionConfig: { title: 'Fazer follow-up com o lead', dueDaysFromNow: 2 },
    },
  ],
};
