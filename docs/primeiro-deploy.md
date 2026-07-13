# Primeiro Deploy — VPS Hostinger (executar uma unica vez)

Este guia cobre o provisionamento inicial da VPS antes de o pipeline automatico entrar em operacao.

---

## 1. Provisionamento da VPS

```bash
# Conectar na VPS como root
ssh root@SEU_IP_VPS

# Atualizar sistema e instalar dependencias
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git curl wget ufw

# Habilitar Docker no boot
systemctl enable docker
systemctl start docker

# (Opcional) Criar usuario de deploy sem senha sudo para Docker
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# Adicionar chave publica SSH do GitHub Actions (ver docs/deploy-secrets.md)
echo "COLE_A_CHAVE_PUBLICA_AQUI" >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

---

## 2. Clonar o repositorio

```bash
mkdir -p /opt/globalengenharia
cd /opt/globalengenharia

# Substituir pela URL real do repositorio
git clone https://github.com/SEU_ORG/SEU_REPO.git .

# Conceder propriedade ao usuario deploy (se criado acima)
chown -R deploy:deploy /opt/globalengenharia
```

---

## 3. Configurar variaveis de ambiente

```bash
cd /opt/globalengenharia

# Copiar o arquivo de exemplo e preencher com valores reais
cp .env.example .env
nano .env  # ou vim .env
```

Variaveis minimas obrigatorias no `.env`:

```dotenv
# Banco de dados
POSTGRES_DB=globalengenharia
POSTGRES_USER=postgres
POSTGRES_PASSWORD=SENHA_FORTE_AQUI

# Redis
REDIS_PASSWORD=SENHA_REDIS_AQUI

# Backend
NODE_ENV=production
JWT_SECRET=SEGREDO_JWT_AQUI
JWT_REFRESH_SECRET=SEGREDO_REFRESH_AQUI
PORT=3333

# Dominio (usado pelo Nginx e CORS)
APP_URL=https://app.seudominio.com.br
API_URL=https://api.seudominio.com.br
```

---

## 4. Primeiro build e subida dos servicos

```bash
cd /opt/globalengenharia

# Build e subida (sem nginx/certbot ainda — sem SSL)
docker compose -f docker-compose.prod.yml up -d postgres redis backend frontend

# Aguardar postgres ficar pronto (30-60s)
docker compose -f docker-compose.prod.yml logs -f postgres
```

---

## 5. Migrations iniciais do banco

```bash
cd /opt/globalengenharia

docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Opcional: seed de dados iniciais (apenas em novo banco)
# docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

---

## 6. Configurar SSL com Let's Encrypt (Certbot)

Antes de executar, garantir que o DNS dos dominios aponta para o IP desta VPS.

```bash
cd /opt/globalengenharia

# Emitir certificado (substituir dominios e email reais)
docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot \
  -w /var/www/certbot \
  -d app.seudominio.com.br \
  -d api.seudominio.com.br \
  --email seu@email.com \
  --agree-tos \
  --no-eff-email

# Subir nginx com SSL
docker compose -f docker-compose.prod.yml up -d nginx certbot
```

---

## 7. Verificacao final

```bash
# Todos os servicos devem estar com status "Up"
docker compose -f docker-compose.prod.yml ps

# Testar endpoint de health do backend
curl -f https://api.seudominio.com.br/health

# Verificar logs
docker compose -f docker-compose.prod.yml logs --tail=50 backend
docker compose -f docker-compose.prod.yml logs --tail=50 frontend
docker compose -f docker-compose.prod.yml logs --tail=50 nginx
```

---

## 8. Firewall (recomendado)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 9. Ativar o pipeline automatico

Apos este passo a passo:

1. Configure os secrets no GitHub conforme `docs/deploy-secrets.md`.
2. Faca um push na branch `main`.
3. Acompanhe em: GitHub → Actions → **Deploy Producao**.

A partir deste ponto, todo push em `main` dispara testes + deploy automatico.

---

## Renovacao automatica do SSL

O servico `certbot` no `docker-compose.prod.yml` ja esta configurado para tentar renovar o certificado a cada 12 horas. Nenhuma acao adicional e necessaria.
