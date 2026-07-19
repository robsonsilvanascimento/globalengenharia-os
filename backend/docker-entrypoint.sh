#!/bin/sh
# Entrypoint de producao do backend. Prepara o banco antes de subir a API:
#   1) espera o Postgres aceitar conexao;
#   2) aplica o schema (prisma db push — fonte de verdade e o schema.prisma;
#      mudancas aditivas, sem perda de dados);
#   3) roda o seed (idempotente: cria admin/categorias/SLA so se faltarem);
#   4) inicia o servidor HTTP.
# O worker de filas usa a MESMA imagem, mas sobe com outro entrypoint
# (node dist/main/worker.js) — so o backend prepara o banco.
set -e

echo "[entrypoint] Aguardando o banco de dados..."
tentativa=0
until npx prisma db push --skip-generate 2>/tmp/dbpush.log; do
  tentativa=$((tentativa + 1))
  if [ "$tentativa" -ge 30 ]; then
    echo "[entrypoint] Banco indisponivel apos varias tentativas:"
    cat /tmp/dbpush.log
    exit 1
  fi
  echo "[entrypoint] Banco ainda nao pronto (tentativa $tentativa) — nova tentativa em 3s..."
  sleep 3
done
echo "[entrypoint] Schema aplicado."

echo "[entrypoint] Rodando seed (idempotente)..."
if ! node dist-seed/seed.js; then
  echo "[entrypoint] Aviso: seed falhou (pode ja estar aplicado) — seguindo."
fi

echo "[entrypoint] Iniciando o servidor..."
exec node dist/main/server.js
