#!/bin/bash
# Monitor Global Engenharia OS
# Instalacao: bash scripts/instalar-monitor.sh

APP_DIR="/opt/globalengenharia"
LOG_FILE="/var/log/globalengenharia/monitor.log"
ALERT_EMAIL="${ALERT_EMAIL:-robsonsilvanascimento2009@gmail.com}"
SERVICOS=("postgres" "redis" "backend" "frontend" "nginx")

mkdir -p /var/log/globalengenharia

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

enviar_email() {
  local assunto="$1"
  local corpo="$2"
  printf '%b' "$corpo" | mail -s "[Global Engenharia OS] $assunto" "$ALERT_EMAIL" 2>/dev/null
}

get_container_state() {
  local servico="$1"
  docker compose -f "$APP_DIR/docker-compose.prod.yml" ps --format json "$servico" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    raw = sys.stdin.read().strip()
    if not raw:
        print('unknown')
        sys.exit(0)
    # docker compose ps --format json pode retornar lista ou objeto unico
    data = json.loads(raw)
    if isinstance(data, list):
        print(data[0].get('State', 'unknown') if data else 'unknown')
    else:
        print(data.get('State', 'unknown'))
except Exception:
    print('unknown')
" 2>/dev/null || echo "unknown"
}

# ============================================================
# 1. Verificar containers Docker
# ============================================================
for servico in "${SERVICOS[@]}"; do
  STATUS=$(get_container_state "$servico")

  if [ "$STATUS" != "running" ]; then
    log "ALERTA: Container $servico esta '$STATUS' — tentando reiniciar"
    docker compose -f "$APP_DIR/docker-compose.prod.yml" restart "$servico" >> "$LOG_FILE" 2>&1
    sleep 15

    NEW_STATUS=$(get_container_state "$servico")

    if [ "$NEW_STATUS" != "running" ]; then
      log "CRITICO: Container $servico nao voltou apos restart (status: $NEW_STATUS)"
      enviar_email "CRITICO: $servico fora do ar" \
"O container $servico nao esta rodando na VPS e nao voltou apos tentativa de restart automatico.

Status atual: $NEW_STATUS

Acesse a VPS e verifique:
  docker compose -f $APP_DIR/docker-compose.prod.yml logs $servico --tail=50"
    else
      log "OK: Container $servico reiniciado com sucesso"
      enviar_email "Aviso: $servico foi reiniciado" \
"O container $servico caiu mas foi reiniciado automaticamente.

Sistema esta funcionando normalmente."
    fi
  fi
done

# ============================================================
# 2. Verificar endpoint de health do backend
# ============================================================
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3333/health 2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
  log "ALERTA: Backend nao responde (HTTP $HTTP_CODE) — reiniciando"
  docker compose -f "$APP_DIR/docker-compose.prod.yml" restart backend >> "$LOG_FILE" 2>&1
  sleep 20

  HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3333/health 2>/dev/null)

  if [ "$HTTP_CODE2" != "200" ]; then
    log "CRITICO: Backend nao voltou apos restart (HTTP $HTTP_CODE2)"
    enviar_email "CRITICO: Backend fora do ar" \
"O backend nao esta respondendo (HTTP $HTTP_CODE2) e nao voltou apos restart automatico.

Verifique os logs:
  docker compose -f $APP_DIR/docker-compose.prod.yml logs backend --tail=100"
  else
    log "OK: Backend voltou apos restart (HTTP $HTTP_CODE2)"
    enviar_email "Aviso: Backend foi reiniciado" \
"O backend estava sem resposta (HTTP $HTTP_CODE) mas voltou automaticamente.

Sistema esta funcionando normalmente."
  fi
fi

# ============================================================
# 3. Verificar uso de disco
# ============================================================
DISK_USE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')

if [ "$DISK_USE" -gt 85 ]; then
  log "ALERTA: Disco com ${DISK_USE}% de uso"
  enviar_email "Aviso: Disco quase cheio (${DISK_USE}%)" \
"O disco da VPS esta com ${DISK_USE}% de uso.

Limpeza sugerida:
  docker system prune -f
  journalctl --vacuum-size=100M
  du -sh /var/log/* | sort -rh | head -10"
fi

# ============================================================
# 4. Verificar uso de RAM
# ============================================================
RAM_FREE=$(free | awk '/^Mem:/ {printf "%.0f", $4/$2*100}')

if [ "$RAM_FREE" -lt 15 ]; then
  log "ALERTA: RAM livre apenas ${RAM_FREE}%"
  TOP_PROCS=$(ps aux --sort=-%mem | head -10)
  enviar_email "Aviso: Pouca memoria RAM (${RAM_FREE}% livre)" \
"A VPS esta com pouca memoria RAM disponivel.

Top processos por consumo de memoria:
$TOP_PROCS"
fi

# ============================================================
# 5. Verificar SSL (expira em menos de 7 dias)
# ============================================================
DOMINIO=$(grep -oP 'server_name \K[^;]+' /opt/globalengenharia/nginx/nginx.conf 2>/dev/null \
  | grep -v '_' | head -1 | tr -d ' ')

if [ -n "$DOMINIO" ]; then
  EXPIRY=$(echo | openssl s_client -servername "$DOMINIO" -connect "$DOMINIO:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

  if [ -n "$EXPIRY" ]; then
    DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))

    if [ "$DAYS_LEFT" -lt 7 ]; then
      log "ALERTA: Certificado SSL expira em ${DAYS_LEFT} dias ($DOMINIO)"
      enviar_email "URGENTE: Certificado SSL expira em ${DAYS_LEFT} dias" \
"O certificado SSL de $DOMINIO expira em $DAYS_LEFT dias.

Renovar agora:
  docker compose -f $APP_DIR/docker-compose.prod.yml run --rm certbot renew
  docker compose -f $APP_DIR/docker-compose.prod.yml restart nginx"
    fi
  fi
fi

# ============================================================
# Resumo final no log
# ============================================================
log "Verificacao concluida — disco: ${DISK_USE}% | RAM livre: ${RAM_FREE}%"
