# Colibri API

Backend da aplicação imobiliária Colibri, desenvolvido com **NestJS**, **Prisma** e **PostgreSQL**.

---

## 🚀 Início Rápido

### Modo de Desenvolvimento (Backend Local + Serviços no Docker)

Neste modo, o banco de dados (**PostgreSQL**) e o **Redis** rodarão em contêineres **Docker**, enquanto a aplicação **NestJS** rodará diretamente na sua máquina, permitindo o _hot-reloading_.

#### ⚙️ Configuração do Ambiente

Copie o arquivo de exemplo `.env.development` para um novo arquivo chamado `.env`:

```bash
cp .env.development .env
Abra o arquivo .env e verifique as variáveis DATABASE_URL e REDIS_URL.
Elas devem apontar para localhost e para as portas expostas no arquivo docker-compose.dev.yml (5433 para o PostgreSQL).

▶️ Iniciar Serviços
Suba os contêineres do PostgreSQL e Redis com o arquivo de desenvolvimento:

bash
Copy code
docker-compose -f docker-compose.dev.yml up -d
📦 Instalar Dependências
bash
Copy code
pnpm install
🗄️ Executar Migrations
Aplique as migrações do Prisma para criar as tabelas no banco de dados:

bash
Copy code
pnpm prisma migrate deploy
🚀 Iniciar a Aplicação
Execute o script para iniciar em modo de desenvolvimento com watch-mode:

bash
Copy code
pnpm run start:dev
A API estará disponível em:
👉 http://localhost:3000

Modo de Produção (Tudo no Docker)
Neste modo, todos os serviços, incluindo a API, serão orquestrados pelo Docker Compose, simulando um ambiente de produção real.

⚙️ Configuração do Ambiente
Copie o arquivo de exemplo .env para um novo arquivo com o mesmo nome (se ainda não o fez):

bash
Copy code
cp .env .env
Abra o arquivo .env e verifique as variáveis de ambiente.
Note que DATABASE_URL e REDIS_URL devem usar os nomes dos serviços definidos no docker-compose.yml (ex: db e redis), não localhost.

▶️ Construir e Iniciar os Contêineres
Use o arquivo docker-compose.yml principal para construir as imagens e iniciar todos os serviços em segundo plano:

bash
Copy code
docker-compose -f docker-compose.yml up -d --build
O entrypoint.sh do contêiner da API se encarregará de rodar as migrations e o seed automaticamente antes de iniciar a aplicação.
A API estará disponível conforme configurado no seu proxy reverso (Traefik).

📜 Scripts Disponíveis
Aqui estão os principais scripts disponíveis no package.json:

pnpm run build: Compila o código TypeScript para JavaScript.

pnpm run format: Formata todo o código-fonte usando o Prettier.

pnpm run start: Inicia a aplicação a partir do código já compilado.

pnpm run start:dev: Inicia a aplicação em modo de desenvolvimento com hot-reload.

pnpm run start:prod: Inicia a aplicação em modo de produção.

pnpm run lint: Executa o ESLint para encontrar e corrigir problemas no código.

pnpm run test: Roda os testes unitários.

pnpm run test:watch: Roda os testes unitários em modo de observação.

pnpm run test:cov: Roda os testes e gera um relatório de cobertura.

pnpm run test:e2e: Roda os testes end-to-end.
```
