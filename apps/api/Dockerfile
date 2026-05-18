# syntax=docker/dockerfile:1.6
# Multi-stage Dockerfile for the Nexora API (NestJS).
# Optimized for Railway / Render / Fly.io: single image, minimal final size.

# ---------- Stage 1: deps + build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm matching repo version
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy monorepo manifests first to leverage Docker cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/prisma ./apps/api/prisma

# Install dependencies (including dev — needed to build TS)
RUN pnpm install --frozen-lockfile

# Generate Prisma client BEFORE build so TypeScript has the generated types
RUN pnpm --filter api exec prisma generate

# Copy source last so we can rebuild without re-fetching deps
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build shared package first (api depends on it), then api
RUN pnpm --filter @nexora/shared build && pnpm --filter api build

# ---------- Stage 2: production runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy only what's needed to run
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Install production deps (inclui @prisma/client mas não o CLI prisma)
RUN pnpm install --prod --frozen-lockfile

# Copia o Prisma CLI do builder para poder rodar migrate deploy no startup
COPY --from=builder /app/node_modules/.bin/prisma /app/node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma /app/node_modules/prisma

# Default port (overridden by PORT env)
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Run migrations on boot then start. Use prisma migrate deploy (non-destructive).
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && node apps/api/dist/main.js"]
