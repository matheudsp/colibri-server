#!/bin/sh

echo "⏳ Aguardando banco de dados..."
until nc -z -v -w30 db 5432; do
  echo "Banco não disponível ainda - esperando..."
  sleep 5
done

echo "🚀 Executando migrations..."
pnpm prisma migrate deploy

echo "✅ Iniciando aplicação..."
exec "$@"
