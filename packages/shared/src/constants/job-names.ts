export const JOB_NAMES = {
  LEAD_CREATED: 'lead.created',
  LEAD_FOLLOW_UP: 'lead.follow_up',
  WORKFLOW_TRIGGER: 'workflow.trigger',
  WEBHOOK_DISPATCH: 'webhook.dispatch',
  FOLLOW_UP_SCAN: 'lead.follow_up.scan',
  FOLLOW_UP_EXECUTE: 'lead.follow_up.execute',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export const QUEUE_NAMES = {
  WORKFLOWS: 'workflows',
  WEBHOOKS: 'webhooks',
  SCHEDULED_JOBS: 'scheduled-jobs',
} as const;
