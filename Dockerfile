FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY prisma.config.ts tsconfig.json ./

# Prisma lê DATABASE_URL ao carregar prisma.config.ts durante a geração do cliente.
# Este valor é só para a etapa de build; o Compose fornece a conexão real em execução.
ENV DATABASE_URL="postgresql://greencode:build_only@127.0.0.1:5432/greencode?schema=public"
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Na inicialização, aplica somente migrações versionadas e executa o seed idempotente.
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed && npm run start"]
