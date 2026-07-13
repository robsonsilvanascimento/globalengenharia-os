# Monitoramento — Global Engenharia OS

Sistema de monitoramento automatico com alertas por e-mail e auto-recuperacao de containers.

---

## Arquivos

| Arquivo | Funcao |
|---|---|
| `scripts/monitor.sh` | Script principal — roda a cada 5 min via cron |
| `scripts/instalar-monitor.sh` | Instalador (rodar uma vez na VPS como root) |
| `scripts/status.sh` | Checagem manual rapida |

---

## Instalacao na VPS

### Pre-requisito: repositorio na VPS

O repositorio do projeto precisa estar em `/opt/globalengenharia` na VPS.

```bash
# Se ainda nao estiver la:
git clone <url-do-repo> /opt/globalengenharia
```

### Configurar e-mail PRIMEIRO (obrigatorio antes de instalar)

Veja a secao "Configuracao de E-mail (Gmail)" abaixo. Sem isso, os alertas nao chegam.

### Instalar o monitor

```bash
cd /opt/globalengenharia
sudo bash scripts/instalar-monitor.sh
```

O script instala automaticamente:
- Pacotes necessarios (`mailutils`, `curl`, `ssmtp`)
- `/usr/local/bin/globalengenharia-monitor` (o monitor em si)
- Cron a cada 5 minutos
- Rotacao de logs em `/etc/logrotate.d/globalengenharia`

---

## Verificacao manual de status

```bash
bash scripts/status.sh
```

Exibe: containers, resposta do `/health`, uso de disco, RAM, carga, dias ate vencer o SSL e os ultimos 20 registros do log.

---

## Ver logs em tempo real

```bash
tail -f /var/log/globalengenharia/monitor.log
```

Ver os ultimos 50 registros:

```bash
tail -50 /var/log/globalengenharia/monitor.log
```

---

## Desinstalar o cron

```bash
# Remove apenas a entrada do globalengenharia-monitor, sem apagar outros crons
crontab -l | grep -v "globalengenharia-monitor" | crontab -
```

Para remover tudo (binario + logs + logrotate):

```bash
rm -f /usr/local/bin/globalengenharia-monitor
rm -rf /var/log/globalengenharia
rm -f /etc/logrotate.d/globalengenharia
crontab -l | grep -v "globalengenharia-monitor" | crontab -
```

---

## O que fazer ao receber cada alerta

### Aviso: container foi reiniciado

O container caiu mas voltou sozinho. Nenhuma acao imediata necessaria.

Investigar a causa para evitar recorrencia:

```bash
docker compose -f /opt/globalengenharia/docker-compose.prod.yml logs <servico> --tail=100
```

### CRITICO: container fora do ar

O container nao subiu automaticamente. Intervencao manual obrigatoria.

```bash
# Ver o que esta acontecendo
docker compose -f /opt/globalengenharia/docker-compose.prod.yml ps
docker compose -f /opt/globalengenharia/docker-compose.prod.yml logs <servico> --tail=50

# Tentar subir manualmente
docker compose -f /opt/globalengenharia/docker-compose.prod.yml up -d <servico>

# Se nao funcionar, reiniciar tudo
docker compose -f /opt/globalengenharia/docker-compose.prod.yml down
docker compose -f /opt/globalengenharia/docker-compose.prod.yml up -d
```

### CRITICO: Backend fora do ar

O processo Node.js parou de responder em `/health` e nao voltou.

```bash
docker compose -f /opt/globalengenharia/docker-compose.prod.yml logs backend --tail=100
docker compose -f /opt/globalengenharia/docker-compose.prod.yml restart backend
```

Se o problema persistir, verificar se ha erro de conexao com Postgres ou Redis nos logs.

### Aviso: Disco quase cheio

Liberar espaco antes de atingir 95% (risco de corrompimento de dados):

```bash
# Remover imagens e containers parados
docker system prune -f

# Compactar logs do sistema
journalctl --vacuum-size=100M

# Identificar o que ocupa mais espaco
du -sh /var/log/* | sort -rh | head -10
du -sh /opt/globalengenharia/postgres-data 2>/dev/null
```

### Aviso: Pouca memoria RAM

```bash
# Ver o que esta consumindo mais
ps aux --sort=-%mem | head -15

# Reiniciar servicos com vazamento de memoria
docker compose -f /opt/globalengenharia/docker-compose.prod.yml restart backend

# Liberar cache do sistema (seguro)
sync && echo 3 > /proc/sys/vm/drop_caches
```

### URGENTE: Certificado SSL expirando

```bash
# Renovar o certificado via certbot
docker compose -f /opt/globalengenharia/docker-compose.prod.yml run --rm certbot renew
docker compose -f /opt/globalengenharia/docker-compose.prod.yml restart nginx
```

Se o certbot nao estiver no compose, verificar se o Let's Encrypt esta configurado via snap:

```bash
certbot renew
systemctl reload nginx
```

---

## Configuracao de E-mail (Gmail)

O monitor usa o comando `mail` para enviar alertas. Na VPS Ubuntu, a forma mais simples e usar o `ssmtp` como relay para o Gmail.

### 1. Criar Senha de App no Google

Acesse: https://myaccount.google.com/apppasswords

- Conta Google: `robsonsilvanascimento2009@gmail.com`
- Selecione "Outro (nome personalizado)" e escreva `GlobalEngenharia VPS`
- Copie a senha de 16 caracteres gerada (ex: `abcd efgh ijkl mnop`)

A senha de app e diferente da sua senha normal do Gmail e e necessaria porque o Gmail bloqueia login direto por SMTP.

### 2. Instalar e configurar ssmtp na VPS

```bash
apt install -y ssmtp mailutils
```

Editar o arquivo de configuracao:

```bash
nano /etc/ssmtp/ssmtp.conf
```

Conteudo (substituir `SENHA_DE_APP` pela senha gerada no passo 1, sem espacos):

```
root=robsonsilvanascimento2009@gmail.com
mailhub=smtp.gmail.com:587
AuthUser=robsonsilvanascimento2009@gmail.com
AuthPass=SENHA_DE_APP
UseSTARTTLS=YES
UseTLS=YES
FromLineOverride=YES
hostname=globalengenharia-vps
```

### 3. Testar o envio

```bash
echo "Teste de alerta da VPS Global Engenharia" | mail -s "Teste monitor" robsonsilvanascimento2009@gmail.com
```

Se o e-mail chegar na caixa de entrada (ou spam), a configuracao esta correta.

### Alternativa: Postfix com relay Gmail

Se preferir usar o Postfix (mais robusto para producao):

```bash
apt install -y postfix libsasl2-modules
```

Durante a instalacao, selecionar "Internet Site" e informar o hostname da VPS.

Adicionar ao final de `/etc/postfix/main.cf`:

```
relayhost = [smtp.gmail.com]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt
```

Criar o arquivo de credenciais:

```bash
echo "[smtp.gmail.com]:587 robsonsilvanascimento2009@gmail.com:SENHA_DE_APP" > /etc/postfix/sasl_passwd
postmap /etc/postfix/sasl_passwd
chmod 600 /etc/postfix/sasl_passwd /etc/postfix/sasl_passwd.db
systemctl restart postfix
```

Testar:

```bash
echo "Teste postfix" | mail -s "Teste" robsonsilvanascimento2009@gmail.com
```

---

## O que o monitor verifica (resumo)

| Verificacao | Frequencia | Acao automatica | Alerta |
|---|---|---|---|
| Containers Docker | 5 min | Restart automatico | Aviso se reiniciou, CRITICO se nao voltou |
| Endpoint `/health` porta 3333 | 5 min | Restart do backend | Aviso se reiniciou, CRITICO se nao voltou |
| Uso de disco `/` | 5 min | Nenhuma | Aviso acima de 85% |
| Uso de RAM | 5 min | Nenhuma | Aviso abaixo de 15% livre |
| Validade SSL | 5 min | Nenhuma | URGENTE abaixo de 7 dias |
