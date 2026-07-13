#!/bin/bash
# Rodar na VPS como root apos configurar o .env
# Uso: sudo bash scripts/permissoes-vps.sh

set -euo pipefail

APP_DIR="/opt/globalengenharia"

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "ERRO: ${APP_DIR}/.env nao encontrado. Configure o arquivo antes de rodar este script."
  exit 1
fi

chmod 600 "${APP_DIR}/.env"
chmod 700 "${APP_DIR}/scripts/"
chown -R root:root "${APP_DIR}/.env"

echo "Permissoes aplicadas com sucesso."
echo "  ${APP_DIR}/.env  -> 600 (root:root)"
echo "  ${APP_DIR}/scripts/ -> 700"
