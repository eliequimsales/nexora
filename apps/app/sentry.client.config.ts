import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Inicializar somente quando a DSN estiver configurada
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Captura 10% das transações em produção — ajustar conforme volume
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Replay de sessão apenas em produção e só quando houver erro
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Não capturar erros de cancelamento de requisição (AbortError)
    ignoreErrors: ['AbortError', 'The user aborted a request'],
  });
}
