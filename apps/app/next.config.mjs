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
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
