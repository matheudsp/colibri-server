#!/bin/sh

sleep 2
echo "A executar as migrations do banco de dados..."
pnpm prisma:migrate:deploy
echo "A iniciar a aplicação..."
exec "$@"