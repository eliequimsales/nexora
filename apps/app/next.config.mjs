/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` é só pra Docker (Railway/Render/Fly). Vercel e dev local
  // não precisam — e no Windows tenta criar symlinks que exigem admin.
  // Ative com NEXT_STANDALONE=1 no Dockerfile.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  transpilePackages: ['@nexora/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  // Proxy /api/* para o backend — resolve problema de cookies cross-domain.
  // Cookies são setados no mesmo dominio do App, middleware ve refresh_token.
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL
      || process.env.NEXT_PUBLIC_API_URL
      || 'http://localhost:3001';
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Impede MIME-type sniffing — protege contra uploads maliciosos
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Proíbe iframe embedding — protege contra clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Não vaza URL completa em referer para domínios externos
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Força HTTPS por 1 ano (Railway já serve HTTPS, mas reforça no browser)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Desativa APIs de browser que a Nexora não usa
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
          // Evita que browser prefetch DNS de domínios de terceiros
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
      // Não cachear respostas da API proxy no browser — evita dados stale de outro usuário
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
