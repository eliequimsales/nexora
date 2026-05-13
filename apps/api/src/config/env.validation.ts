import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3001),

  DATABASE_URL: Joi.string().uri().required(),

  REDIS_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),

  CLAUDE_API_KEY: Joi.string().when('LLM_PROVIDER', {
    is: 'claude',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  LLM_PROVIDER: Joi.string().valid('claude', 'mock').default('mock'),
  LLM_MODEL: Joi.string().default('claude-haiku-4-5-20251001'),

  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),

  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  STRIPE_PRICE_STARTER: Joi.string().optional(),
  STRIPE_PRICE_PRO: Joi.string().optional(),
  STRIPE_PRICE_BUSINESS: Joi.string().optional(),

  // 64-char hex string (32 bytes). Required in production.
  INTEGRATION_ENCRYPTION_KEY: Joi.string()
    .length(64)
    .pattern(/^[0-9a-fA-F]+$/)
    .default('0000000000000000000000000000000000000000000000000000000000000000'),
});
