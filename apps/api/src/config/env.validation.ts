import * as Joi from 'joi';

/**
 * Validação de variáveis de ambiente.
 *
 * Em produção, várias variáveis ficam obrigatórias (e mais restritas) via
 * `.when('NODE_ENV')`. Isso garante que um deploy com config faltando ou
 * insegura falhe na inicialização, e não silenciosamente em runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3001),

  DATABASE_URL: Joi.string().uri().required(),

  REDIS_URL: Joi.string().uri().required(),

  // Em produção exigimos JWT_SECRET >= 48 chars (entropia). Em dev/test: 32.
  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(48).required(),
    otherwise: Joi.string().min(32).required(),
  }),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),

  CLAUDE_API_KEY: Joi.string().when('LLM_PROVIDER', {
    is: 'claude',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // Em produção: força LLM_PROVIDER=claude. Mock em produção gera mensagens
  // sem nome real do cliente, o que arruina a percepção do produto.
  LLM_PROVIDER: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('claude').required(),
    otherwise: Joi.string().valid('claude', 'mock').default('mock'),
  }),
  LLM_MODEL: Joi.string().default('claude-haiku-4-5-20251001'),

  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),

  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  // Stripe: opcional em dev (permite ignorar billing), obrigatório em prod.
  STRIPE_SECRET_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .pattern(/^sk_(live|test)_/)
      .required(),
    otherwise: Joi.optional(),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().pattern(/^whsec_/).required(),
    otherwise: Joi.optional(),
  }),
  STRIPE_PRICE_STARTER: Joi.string().optional(),
  STRIPE_PRICE_PRO: Joi.string().optional(),
  STRIPE_PRICE_BUSINESS: Joi.string().optional(),

  // Webhook público (/leads/webhooks/response). OBRIGATÓRIO em produção —
  // sem ele o endpoint aceita qualquer corpo da internet (envenenamento).
  NEXORA_WEBHOOK_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(24).required(),
    otherwise: Joi.optional(),
  }),

  // 64-char hex string (32 bytes). Required in production. A chave de zeros
  // é placeholder de dev e fica explicitamente PROIBIDA em produção.
  INTEGRATION_ENCRYPTION_KEY: Joi.string()
    .length(64)
    .pattern(/^[0-9a-fA-F]+$/)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .disallow('0000000000000000000000000000000000000000000000000000000000000000')
        .required(),
      otherwise: Joi.string().default(
        '0000000000000000000000000000000000000000000000000000000000000000',
      ),
    }),

  // Resend (email transacional + relatório semanal). Opcional em dev.
  // Em produção é recomendado mas não fatal — o report fail-silent.
  RESEND_API_KEY: Joi.string().optional(),
  RESEND_FROM_EMAIL: Joi.string().email().optional(),
  RESEND_FROM_NAME: Joi.string().optional(),

  // Z-API (WhatsApp não-oficial). Opcional — o produto usa modo manual por
  // padrão e Z-API é um modo legacy mantido só para testes.
  ZAPI_INSTANCE_ID: Joi.string().optional(),
  ZAPI_TOKEN: Joi.string().optional(),
  ZAPI_CLIENT_TOKEN: Joi.string().optional(),
});
