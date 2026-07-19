# Checklist de Produção — Global Engenharia OS

Marque cada item conforme for concluindo (`[ ]` → `[x]`). O passo a passo
detalhado de como subir está no [`DEPLOY.md`](./DEPLOY.md). Este arquivo é só
o "mapa" do que precisa estar pronto.

> Legenda: 🟢 dá para testar em modo teste antes de ter o definitivo ·
> ⏳ pode levar dias (verificação) · 🔒 segredo, nunca comitar

---

## 1. Infraestrutura (VPS)

- [ ] VPS Linux contratada, com **Docker** e **Docker Compose v2** instalados
- [ ] **Domínio** registrado e com os subdomínios apontando (registro A) para o IP da VPS:
  - [ ] `app.SEU-DOMINIO` (painel)
  - [ ] `api.SEU-DOMINIO` (backend)
  - [ ] `portal.SEU-DOMINIO` (portal do cliente)
- [ ] Ajustar os nomes de domínio em `nginx/nginx.conf`
- [ ] Portas **80** e **443** liberadas no firewall
- [ ] Repositório clonado na VPS (`git clone`)

## 2. `.env` — segredos internos (você mesmo define) 🔒

- [ ] `cp .env.example .env`
- [ ] `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (senha forte)
- [ ] `REDIS_PASSWORD` (senha forte)
- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` (ex.: `openssl rand -hex 32` para cada)
- [ ] `ADMIN_SEED_EMAIL` (e-mail do primeiro login)
- [ ] `ADMIN_SEED_SENHA` (senha do 1º admin; se deixar em branco, aparece nos logs no 1º boot)
- [ ] `FRONTEND_URL` = `https://app.SEU-DOMINIO`

> Com só as seções 1 e 2 prontas, **o sistema já sobe e todo o painel funciona**
> (OS, laudos, contas a receber, contratos, rota). WhatsApp e Pix ficam inativos
> até as seções 3 e 4.

## 3. WhatsApp — Meta Cloud API

**Pré-requisitos**
- [ ] Conta no **Meta for Developers** (developers.facebook.com)
- [ ] **Número de telefone dedicado** 🟢 (não pode ter WhatsApp ativo; precisa receber SMS/ligação)
  - [ ] Se o número já tem WhatsApp, **excluir a conta** daquele número antes
- [ ] ⏳ **Verificação do negócio** (Business Verification — CNPJ) para tirar limites de mensagens (pode correr em paralelo)

**Criar o app e o produto WhatsApp**
- [ ] Criar um **App** (tipo "Empresa") no Meta for Developers
- [ ] Adicionar o produto **WhatsApp**
- [ ] Registrar/verificar o número (ou usar o **número de teste** 🟢 grátis, até 5 destinos, para testar antes)

**Credenciais → `.env`** 🔒
- [ ] `META_PHONE_NUMBER_ID` — WhatsApp → API Setup → "Phone number ID" (ID numérico)
- [ ] `META_WHATSAPP_TOKEN` — token de acesso **permanente** (via System User, não o temporário de 24h)
- [ ] `META_VERIFY_TOKEN` — você inventa uma senha; use a mesma no webhook abaixo
- [ ] `META_APP_SECRET` — App → Configurações → Básico → "Chave secreta do app"

**Webhook**
- [ ] Configurar o webhook do WhatsApp na Meta:
  - URL: `https://api.SEU-DOMINIO/webhook/whatsapp`
  - Verify token: o mesmo valor de `META_VERIFY_TOKEN`
  - [ ] Assinar o campo **messages**

**Templates de mensagem** (criar e **aprovar** na Meta) ⏳
- [ ] `WHATSAPP_TEMPLATE_PIX_COBRANCA` — cobrança Pix (params: nº OS, valor, código Pix)
- [ ] `META_TEMPLATE_LEMBRETE_AGENDAMENTO` — lembrete 24h (params: nº OS, data/hora)
- [ ] `META_TEMPLATE_TECNICO_A_CAMINHO` — técnico a caminho (params: nº OS, situação)

## 4. Pix — Mercado Pago

**Pré-requisitos**
- [ ] Conta Mercado Pago da **empresa** que possa **receber Pix** (chave Pix cadastrada)
- [ ] ⏳ Conta verificada para recebimento

**Criar a aplicação**
- [ ] Mercado Pago → **Desenvolvedores → Suas integrações → criar aplicação**

**Credenciais → `.env`** 🔒
- [ ] `MERCADOPAGO_ACCESS_TOKEN` — Credenciais → **Access Token** (Teste 🟢 para validar, Produção para valer)
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` — a **"assinatura secreta"** gerada ao configurar o webhook

**Webhook**
- [ ] Configurar Webhooks/Notificações na aplicação:
  - URL: `https://api.SEU-DOMINIO/webhooks/mercadopago`
  - [ ] Marcar o evento **Pagamentos (payment)**
  - [ ] Copiar a assinatura secreta → `MERCADOPAGO_WEBHOOK_SECRET`

## 5. Subir e testar

- [ ] Emitir certificados SSL (certbot) — ver `DEPLOY.md` §4
- [ ] `docker compose -f docker-compose.prod.yml up -d --build`
- [ ] Confirmar que subiu: `docker compose -f docker-compose.prod.yml ps` (backend, worker, postgres, redis, frontend, nginx)
- [ ] Primeiro login em `https://app.SEU-DOMINIO` e **trocar a senha do admin**
- [ ] Rodar o **roteiro de teste do painel** (DEPLOY.md §7)
- [ ] 🟢 Testar o bot com o **número de teste** da Meta (mandar mensagem, ver resposta)
- [ ] 🟢 Testar um Pix em **sandbox** (gerar cobrança, pagar com usuário de teste, ver a baixa automática)

## 6. Go-live (trocar teste → produção)

- [ ] Trocar credenciais Meta e Mercado Pago de **teste** para **produção** no `.env`
- [ ] Concluídas as verificações de negócio (Meta e Mercado Pago)
- [ ] `git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`
- [ ] Fazer um pagamento **real** de valor pequeno para validar ponta a ponta
- [ ] Agendar **backup** periódico do Postgres (DEPLOY.md §10)

---

### Referência rápida — variáveis do `.env`

| Origem | Variáveis |
| --- | --- |
| Você define | `POSTGRES_*`, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_SEED_*`, `FRONTEND_URL` |
| Meta | `META_PHONE_NUMBER_ID`, `META_WHATSAPP_TOKEN`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `WHATSAPP_TEMPLATE_PIX_COBRANCA`, `META_TEMPLATE_LEMBRETE_AGENDAMENTO`, `META_TEMPLATE_TECNICO_A_CAMINHO` |
| Mercado Pago | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` |

### Webhooks (para colar nos painéis)

- WhatsApp: `https://api.SEU-DOMINIO/webhook/whatsapp`
- Mercado Pago: `https://api.SEU-DOMINIO/webhooks/mercadopago`
