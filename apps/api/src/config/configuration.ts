export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',

  // Compat alias — alguns serviços consomem como `app.env`
  app: {
    env: process.env.NODE_ENV ?? 'development',
  },

  webhook: {
    // Secret compartilhado pelo header `X-Webhook-Secret` no endpoint público
    // `/leads/webhooks/response`. Em produção é OBRIGATÓRIO — sem ele o
    // controller rejeita 401.
    secret: process.env.NEXORA_WEBHOOK_SECRET ?? '',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS),
  },

  llm: {
    provider: process.env.LLM_PROVIDER as 'claude' | 'mock',
    model: process.env.LLM_MODEL,
    apiKey: process.env.CLAUDE_API_KEY,
  },

  integrations: {
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY ?? 'dev-key-change-in-production-32b',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    prices: {
      starter: process.env.STRIPE_PRICE_STARTER ?? '',
      pro: process.env.STRIPE_PRICE_PRO ?? '',
      business: process.env.STRIPE_PRICE_BUSINESS ?? '',
    },
  },

  zapi: {
    instanceId: process.env.ZAPI_INSTANCE_ID || '',
    token: process.env.ZAPI_TOKEN || '',
    clientToken: process.env.ZAPI_CLIENT_TOKEN || '',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || '',
    fromName: process.env.RESEND_FROM_NAME || 'Assistente Financeiro',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL
      || `${process.env.APP_URL ?? 'http://localhost:3001'}/api/v1/auth/google/callback`,
  },
});

export type AppConfig = ReturnType<typeof configuration>;
