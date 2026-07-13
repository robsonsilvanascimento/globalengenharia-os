#!/bin/sh
# Backup do PostgreSQL com envio para Google Drive via rclone.
#
# Dependencias:
#   - pg_dump (cliente postgresql)
#   - rclone configurado: execute "rclone config" e crie um remote chamado
#     GDRIVE_REMOTE apontando para o Google Drive desejado.
#     Documentacao: https://rclone.org/drive/
#
# Variaveis de ambiente esperadas (defina no host ou no .env do servidor):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST (default: localhost)
#   GDRIVE_REMOTE  — nome do remote rclone (ex: gdrive)
#   GDRIVE_PATH    — caminho no Drive (ex: backups/postgres)
#   BACKUP_RETAIN_DAYS — dias para manter backups locais (default: 7)

set -e

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR=${BACKUP_DIR:-/var/backups/postgres}
DB_HOST=${POSTGRES_HOST:-localhost}
DB_USER=${POSTGRES_USER}
DB_NAME=${POSTGRES_DB}
GDRIVE_REMOTE=${GDRIVE_REMOTE:-gdrive}
GDRIVE_PATH=${GDRIVE_PATH:-backups/postgres}
RETAIN_DAYS=${BACKUP_RETAIN_DAYS:-7}
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

mkdir -p "$BACKUP_DIR"

log "Iniciando backup de ${DB_NAME}..."

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  "$DB_NAME" | gzip > "$FILEPATH"

log "Dump gerado: ${FILEPATH}"

log "Enviando para ${GDRIVE_REMOTE}:${GDRIVE_PATH}..."
rclone copy "$FILEPATH" "${GDRIVE_REMOTE}:${GDRIVE_PATH}"
log "Envio concluido."

log "Removendo backups locais com mais de ${RETAIN_DAYS} dias..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
log "Limpeza concluida."

log "Backup finalizado com sucesso: ${FILENAME}"
