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
