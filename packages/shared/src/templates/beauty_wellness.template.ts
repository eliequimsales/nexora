import { beautyWellnessConfig } from '../niche-configs/beauty_wellness';
import type { TemplateDefinition } from './types';

export const beautyWellnessTemplate: TemplateDefinition = {
  id: 'beauty_wellness_v1',
  name: 'Barbearia / Beleza',
  description: 'Pipeline e automações para barbearias e salões de beleza: detecção de clientes inativos, mensagens de reativação no WhatsApp e follow-up automático.',
  niche: 'beauty_wellness',
  version: '1.0.0',

  pipelineStages: beautyWellnessConfig.pipelineStages,
  aiPrompts: beautyWellnessConfig.aiPrompts,

  workflows: [
    {
      name: 'Classificar novo cliente',
      description: 'Classifica automaticamente todo cliente recém-cadastrado com IA.',
      triggerType: 'lead_created',
      triggerConditions: {},
      actionType: 'ai_classify',
      actionConfig: { promptKey: 'classify' },
    },
    {
      name: 'Mensagem de reativação para inativo',
      description: 'Gera mensagem personalizada quando cliente é detectado como inativo (30+ dias sem voltar).',
      triggerType: 'lead_classified',
      triggerConditions: { classification: 'inactive' },
      actionType: 'ai_respond',
      actionConfig: { promptKey: 'respond' },
    },
    {
      name: 'Lembrar de retornar cliente',
      description: 'Cria tarefa de follow-up 7 dias após cliente entrar em "Cliente Ativo".',
      triggerType: 'lead_stage_changed',
      triggerConditions: { stage: 'Cliente Ativo' },
      actionType: 'create_task',
      actionConfig: { title: 'Verificar se cliente quer reagendar', dueDaysFromNow: 7 },
    },
  ],
};
