#!/bin/bash
# Testa performance dos endpoints principais após deploy
# Uso: ./benchmark.sh [BASE_URL]
# Exemplo: ./benchmark.sh https://api.seudominio.com.br

BASE_URL=${1:-https://api.seudominio.com.br}

echo "=============================="
echo "Benchmark: $BASE_URL"
echo "=============================="

echo ""
echo "--- Health check (tempo de resposta) ---"
curl -o /dev/null -s -w "Health: %{time_total}s | Status: %{http_code}\n" "$BASE_URL/health"

echo ""
echo "--- Gzip ativo ---"
GZIP=$(curl -sI -H 'Accept-Encoding: gzip' "$BASE_URL/health" | grep -i content-encoding)
if [ -n "$GZIP" ]; then
  echo "Gzip ativo: $GZIP"
else
  echo "Gzip NAO detectado na resposta"
fi

echo ""
echo "--- Latencia em 5 requisicoes consecutivas ---"
for i in 1 2 3 4 5; do
  curl -o /dev/null -s -w "Req $i: %{time_total}s | Status: %{http_code}\n" "$BASE_URL/health"
done

echo ""
echo "--- Headers de seguranca ---"
curl -sI "$BASE_URL/health" | grep -iE "strict-transport|x-frame|x-content-type|x-xss|referrer-policy|permissions-policy"

echo ""
echo "=============================="
echo "Benchmark concluido"
echo "=============================="
