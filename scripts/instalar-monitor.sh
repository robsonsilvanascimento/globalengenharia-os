#!/bin/bash
# Instala o monitoramento automatico na VPS — rodar como root
# Uso: bash scripts/instalar-monitor.sh

set -e

ALERT_EMAIL="${ALERT_EMAIL:-robsonsilvanascimento2009@gmail.com}"
MONITOR_BIN="/usr/local/bin/globalengenharia-monitor"
LOG_DIR="/var/log/globalengenharia"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: Execute como root (sudo bash scripts/instalar-monitor.sh)"
  exit 1
fi

echo "[1/6] Atualizando lista de pacotes..."
apt-get update -qq

echo "[2/6] Instalando dependencias (mailutils, curl, ssmtp)..."
apt-get install -y -qq mailutils curl ssmtp

echo "[3/6] Criando diretorio de logs..."
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

echo "[4/6] Instalando script de monitoramento em $MONITOR_BIN..."
# O script deve ser executado a partir do diretorio do projeto na VPS
# ex: /opt/globalengenharia — copie este repositorio la antes de rodar
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/monitor.sh" "$MONITOR_BIN"
chmod +x "$MONITOR_BIN"

echo "[5/6] Configurando cron (a cada 5 minutos)..."
# Remove entrada anterior se existir, depois adiciona nova
CRON_CMD="*/5 * * * * ALERT_EMAIL=$ALERT_EMAIL $MONITOR_BIN"
( crontab -l 2>/dev/null | grep -v "globalengenharia-monitor" ; echo "$CRON_CMD" ) | crontab -
echo "    Cron configurado: $CRON_CMD"

echo "[6/6] Configurando rotacao de logs (14 dias, comprimidos)..."
cat > /etc/logrotate.d/globalengenharia << 'EOF'
/var/log/globalengenharia/monitor.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
EOF

echo ""
echo "========================================"
echo " Instalacao concluida!"
echo "========================================"
echo ""
echo "Rodando primeira verificacao..."
ALERT_EMAIL="$ALERT_EMAIL" "$MONITOR_BIN"
echo ""
echo "Logs em: $LOG_DIR/monitor.log"
echo "Para acompanhar em tempo real: tail -f $LOG_DIR/monitor.log"
echo ""
echo "IMPORTANTE: Configure o envio de e-mail antes que os alertas funcionem."
echo "Consulte docs/monitoramento.md — secao 'Configuracao de E-mail (Gmail)'."
