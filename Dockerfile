# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copia código
COPY tsconfig.json ./
COPY src ./src

# Gera Prisma Client
RUN pnpm prisma generate

# 🔑 Compila usando o script do package.json
RUN pnpm run build

# Etapa final (execução)
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

# Copia dependências e build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY package.json ./

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

CMD ["node", "dist/src/main.js"]
ENTRYPOINT ["./entrypoint.sh"]


