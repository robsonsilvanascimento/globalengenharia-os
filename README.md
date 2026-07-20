# Global Engenharia OS

Sistema de Ordens de Serviço da Global Painéis Elétricos: atendimento via chatbot do WhatsApp, gestão de OS, técnicos, laudos, financeiro (contas a receber, contratos recorrentes), pagamentos via Pix (Mercado Pago) e um painel administrativo web.

## Stack

- **Backend**: Node.js + TypeScript, Fastify, Prisma (PostgreSQL), BullMQ (Redis) para filas de mensagens/PDFs/cobranças.
- **Frontend**: React + TypeScript + Vite, tokens de design próprios (`frontend/src/global.css`), dark mode.
- **App mobile** (técnico/ajudante): repositório separado, [`app-mobile-global-paineis`](https://github.com/robsonsilvanascimento/app-mobile-global-paineis).

## Estrutura

```
backend/    API + workers de fila (Fastify, Prisma, BullMQ)
frontend/   Painel administrativo (React + Vite)
docs/       Guias de deploy, segurança e requisitos por fase
nginx/      Config do proxy reverso (produção)
```

## Rodando localmente

**Backend:**
```bash
cd backend
cp .env.example .env   # ajuste DATABASE_URL, REDIS_URL, JWT_SECRET etc.
npm install
npx prisma migrate deploy   # aplica o schema (veja nota abaixo se for a primeira vez)
npx prisma db seed          # cria o admin inicial + categorias de serviço
npm run dev
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

> Alternativa rápida com Docker: `docker compose -f docker-compose.dev.yml up` sobe Postgres, Redis, backend e frontend de uma vez.

## Testes e qualidade

```bash
cd backend  && npm run typecheck && npm run lint && npm test
cd frontend && npx tsc --noEmit  && npm run lint && npm test
```

O CI (`.github/workflows/deploy.yml`) roda essas mesmas checagens antes de qualquer deploy.

## Deploy em produção

Guia completo em [`DEPLOY.md`](./DEPLOY.md). Resumo do fluxo: push em `main` → CI valida → deploy automático via SSH na VPS (Docker Compose). A VPS **não** atualiza sozinha com um merge — só quando o workflow de deploy roda com sucesso.

## Documentação adicional

- [`DEPLOY.md`](./DEPLOY.md) — passo a passo completo de deploy (VPS, SSL, integrações).
- [`CHECKLIST-PRODUCAO.md`](./CHECKLIST-PRODUCAO.md) — checklist único antes de ir ao ar.
- [`AUDITORIA-INTEGRACOES-EXTERNAS.md`](./AUDITORIA-INTEGRACOES-EXTERNAS.md) — conformidade com contratos de APIs externas (Meta, Mercado Pago).
- [`docs/`](./docs) — segurança de variáveis de ambiente, monitoramento, requisitos por fase do projeto.
- [`backend/prisma/migrations-legacy/README.md`](./backend/prisma/migrations-legacy/README.md) — histórico de schema anterior à adoção formal do Prisma Migrate, e o passo único de adoção necessário em produção.
