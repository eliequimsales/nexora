export interface TemplateOutput {
  subject: string;
  text: string;
  html?: string;
}

type Vars = Record<string, string | number | undefined>;

function interpolate(template: string, vars: Vars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

interface TemplateDefinition {
  subject: string;
  text: string;
  html: string;
}

const TEMPLATES: Record<string, TemplateDefinition> = {
  welcome: {
    subject: 'Bem-vindo à plataforma',
    text: 'Olá, {{name}}! Sua conta foi criada com sucesso. Acesse: {{link}}',
    html: '<p>Olá, <strong>{{name}}</strong>!</p><p>Sua conta foi criada com sucesso.</p><p><a href="{{link}}">Acessar plataforma</a></p>',
  },
  proposal_sent: {
    subject: 'Você recebeu uma proposta: {{proposalTitle}}',
    text: 'Olá, {{leadName}}! Você recebeu uma proposta. Acesse: {{link}}',
    html: '<p>Olá, <strong>{{leadName}}</strong>!</p><p>Você recebeu uma proposta. <a href="{{link}}">Visualizar proposta</a></p>',
  },
  lead_assigned: {
    subject: 'Lead atribuído a você: {{leadName}}',
    text: 'Olá, {{userName}}! O lead "{{leadName}}" foi atribuído a você. Acesse a plataforma para mais detalhes.',
    html: '<p>Olá, <strong>{{userName}}</strong>!</p><p>O lead <strong>{{leadName}}</strong> foi atribuído a você.</p>',
  },
  task_due_soon: {
    subject: 'Tarefa com prazo próximo: {{taskTitle}}',
    text: 'Olá, {{userName}}! A tarefa "{{taskTitle}}" vence em {{dueDate}}. Acesse a plataforma para ver os detalhes.',
    html: '<p>Olá, <strong>{{userName}}</strong>!</p><p>A tarefa <strong>{{taskTitle}}</strong> vence em <strong>{{dueDate}}</strong>.</p>',
  },
};

export function resolveTemplate(template: string, vars: Vars): TemplateOutput {
  const def = TEMPLATES[template];
  if (!def) throw new Error(`Template "${template}" não encontrado`);
  return {
    subject: interpolate(def.subject, vars),
    text: interpolate(def.text, vars),
    html: interpolate(def.html, vars),
  };
}
