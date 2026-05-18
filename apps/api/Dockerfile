# syntax=docker/dockerfile:1.6
# Single-stage Dockerfile para Nexora API (NestJS).
# Inclui dev dependencies para garantir prisma CLI disponível em runtime.
# Imagem maior mas sem problemas de multi-stage com pnpm virtual store.

FROM node:20-alpine

WORKDIR /app

# openssl necessario para Prisma no Alpine Linux
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copiar manifests do monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/prisma ./apps/api/prisma

# Instalar TODAS as dependencias (inclui devDeps com prisma CLI)
RUN pnpm install --frozen-lockfile

# Gerar Prisma Client ANTES do build TypeScript (precisa dos types gerados)
RUN pnpm --filter api exec prisma generate

# Copiar source
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build: shared primeiro (api depende dele), depois api
RUN pnpm --filter @nexora/shared build && pnpm --filter api build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Rodar migrations no startup e iniciar a API
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && node apps/api/dist/main.js"]
