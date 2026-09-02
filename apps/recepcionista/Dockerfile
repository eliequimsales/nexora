# Contexto de build = raiz do monorepo (upload do railway up)
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@10.33.0
WORKDIR /app
COPY apps/recepcionista/package.json ./
RUN pnpm install
COPY apps/recepcionista/ ./
RUN pnpm build

FROM node:22-slim AS run
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@10.33.0
WORKDIR /app
ENV NODE_ENV=production
# A imagem node ja traz o usuario `node` sem privilegio. Sem esta linha o
# processo roda como root: qualquer execucao de codigo dentro do app acontece
# com poder total sobre o container. Achado da auditoria de 01/09/2026.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Aplica o schema no boot (rede interna, idempotente) e sobe o app —
# elimina a necessidade de rodar migrações de fora do Railway.
CMD ["sh", "-c", "npx prisma db push --skip-generate && pnpm start"]
