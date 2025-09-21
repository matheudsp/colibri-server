# Etapa 1: Builder - Instala todas as dependências e compila o código
FROM node:20-alpine AS builder

WORKDIR /app

# Copia apenas os arquivos de manifesto de pacote
COPY package.json pnpm-lock.yaml* ./

# Habilita o pnpm e instala TODAS as dependências (dev e prod) para a compilação
RUN corepack enable && pnpm install --frozen-lockfile

# Copia o restante do código-fonte (respeitando o .dockerignore)
COPY . .

# Gera o cliente Prisma
RUN pnpm prisma generate

# Constrói a aplicação
RUN pnpm run build

# Remove as dependências de desenvolvimento, mantendo apenas as de produção
RUN pnpm prune --prod


# Etapa 2: Runner - A imagem final, otimizada e enxuta
FROM node:20-alpine AS runner

WORKDIR /app

# Define o ambiente como produção
ENV NODE_ENV=production

# Instala o Chromium e suas dependências, e depois limpa o cache e arquivos desnecessários
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Habilita o pnpm
RUN corepack enable

# Copia os artefatos da etapa de build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/prisma ./src/prisma
COPY --from=builder /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY package.json ./

# Copia os templates e assets que o Nest build não copia
COPY --from=builder /app/src/modules/pdfs/templates ./dist/src/modules/pdfs/templates
COPY --from=builder /app/src/modules/pdfs/assets ./dist/src/modules/pdfs/assets
COPY --from=builder /app/src/mailer/templates ./dist/src/mailer/templates

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Define um usuário não-root por segurança
USER node

CMD ["node", "dist/main.js"]
ENTRYPOINT ["./entrypoint.sh"]