#!/bin/bash
# Verifica status completo da aplicacao Global Engenharia OS
# Uso: bash scripts/status.sh

APP_DIR="/opt/globalengenharia"
LOG_FILE="/var/log/globalengenharia/monitor.log"

linha() { printf '%0.s=' {1..50}; echo; }

linha
echo " Global Engenharia OS — Status $(date '+%Y-%m-%d %H:%M:%S')"
linha

# ---- Containers ----
echo ""
echo "CONTAINERS:"
docker compose -f "$APP_DIR/docker-compose.prod.yml" ps

# ---- Saude do backend ----
echo ""
echo "SAUDE DO BACKEND (GET /health):"
RESPONSE=$(curl -s --max-time 10 http://localhost:3333/health 2>/dev/null)
if [ -n "$RESPONSE" ]; then
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
  echo "  Backend nao respondeu (timeout ou porta fechada)"
fi

# ---- Nginx ----
echo ""
echo "NGINX:"
if docker compose -f "$APP_DIR/docker-compose.prod.yml" exec -T nginx nginx -t 2>&1 | grep -q "successful"; then
  echo "  Configuracao OK"
else
  echo "  ATENCAO: problema na configuracao do nginx"
  docker compose -f "$APP_DIR/docker-compose.prod.yml" exec -T nginx nginx -t 2>&1
fi

# ---- Disco ----
echo ""
echo "DISCO:"
df -h /

# ---- RAM ----
echo ""
echo "RAM:"
free -h

# ---- Carga do sistema ----
echo ""
echo "CARGA DO SISTEMA (load average):"
uptime

# ---- SSL ----
echo ""
echo "CERTIFICADO SSL:"
DOMINIO=$(grep -oP 'server_name \K[^;]+' "$APP_DIR/nginx/nginx.conf" 2>/dev/null \
  | grep -v '_' | head -1 | tr -d ' ')

if [ -n "$DOMINIO" ]; then
  EXPIRY=$(echo | openssl s_client -servername "$DOMINIO" -connect "$DOMINIO:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$EXPIRY" ]; then
    DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))
    echo "  Dominio: $DOMINIO"
    echo "  Expira em: $EXPIRY ($DAYS_LEFT dias restantes)"
    if [ "$DAYS_LEFT" -lt 7 ]; then
      echo "  ATENCAO: certificado expira em menos de 7 dias!"
    fi
  else
    echo "  Nao foi possivel verificar o certificado de $DOMINIO"
  fi
else
  echo "  Dominio nao identificado no nginx.conf"
fi

# ---- Ultimos alertas ----
echo ""
echo "ULTIMOS REGISTROS DO MONITOR:"
if [ -f "$LOG_FILE" ]; then
  tail -20 "$LOG_FILE"
else
  echo "  Nenhum log encontrado em $LOG_FILE"
  echo "  Execute instalar-monitor.sh para ativar o monitoramento"
fi

echo ""
linha
