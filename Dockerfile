# Use uma imagem base do Node.js
FROM node:18-alpine

# Instala o pnpm globalmente dentro do contêiner
RUN npm install -g pnpm

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de manifesto do pnpm e o package.json
COPY package.json pnpm-lock.yaml ./

# Instala as dependências de forma otimizada usando o lockfile
RUN pnpm install --frozen-lockfile

# Copia o restante do código da sua aplicação
COPY . .

# Compila o projeto TypeScript
RUN pnpm run build

# Expõe a porta da aplicação
EXPOSE 3000

# Comando para iniciar a aplicação em produção
CMD ["pnpm", "run", "start:prod"]