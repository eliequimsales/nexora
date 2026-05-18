# syntax=docker/dockerfile:1.6
# Multi-stage Dockerfile for the Nexora App (Next.js).
# Uses Next.js standalone output for a minimal final image.

# ---------- Stage 1: deps + build ----------
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy monorepo manifests first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json ./apps/app/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/app ./apps/app
COPY packages/shared ./packages/shared

# Build shared first then app — NEXT_PUBLIC_* must be present at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Liga o output standalone (necessário pro Dockerfile, ignorado fora)
ENV NEXT_STANDALONE=1

RUN pnpm --filter @nexora/shared build && pnpm --filter app build

# ---------- Stage 2: production runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Next.js standalone bundles everything needed — no pnpm install required.
COPY --from=builder /app/apps/app/.next/standalone ./
COPY --from=builder /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder /app/apps/app/public ./apps/app/public

EXPOSE 3000

CMD ["node", "apps/app/server.js"]
