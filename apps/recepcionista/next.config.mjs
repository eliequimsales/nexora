/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Necessário no Next 14 para o instrumentation.ts (worker de follow-up)
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // CSP. A aplicação não tem dangerouslySetInnerHTML em lugar nenhum e
          // o React escapa por padrão, mas CSP é a segunda linha: se um XSS
          // aparecer amanhã, ela limita o que o script consegue fazer.
          //
          // 'unsafe-inline' em script-src é exigido pelo Next 14 App Router,
          // que injeta o payload de hidratação inline. Trocar por nonce exige
          // middleware por requisição e desliga a otimização estática — o
          // caminho certo, quando houver motivo. Está escrito aqui para não
          // parecer que ninguém percebeu.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // A página só fala com a própria origem. Sem isto, um XSS
              // exfiltraria a base de clientes para qualquer servidor.
              "connect-src 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
