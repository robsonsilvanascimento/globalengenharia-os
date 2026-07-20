# Guia de Deploy — Global Engenharia OS

Passo a passo para colocar o sistema no ar numa VPS com Docker. O deploy sobe
tudo: banco (PostgreSQL), fila (Redis), API, worker de filas, frontend e o
proxy (nginx + SSL).

> **Importante:** dar merge/push no GitHub **não** altera a VPS. A VPS só muda
> quando alguém faz `git pull` + rebuild dos containers nela (passo 6).

---

## 1. Pré-requisitos

- Uma VPS Linux com **Docker** e **Docker Compose v2** instalados.
- **Domínios** apontando para o IP da VPS (registros A). O projeto já vem
  configurado (em `nginx/nginx.conf`) para:
  - `app.SEU-DOMINIO` — painel administrativo (frontend)
  - `api.SEU-DOMINIO` — backend/API
  - `portal.SEU-DOMINIO` — portal do cliente
  - Ajuste esses nomes em `nginx/nginx.conf` para o seu domínio real.
- Portas **80** e **443** liberadas no firewall.

## 2. Clonar o repositório na VPS

```bash
git clone https://github.com/robsonsilvanascimento/globalengenharia-os.git
cd globalengenharia-os
```

## 3. Configurar o `.env`

Copie o exemplo e preencha:

```bash
cp .env.example .env
nano .env
```

Preencha no mínimo (o resto pode ficar em branco por enquanto):

| Variável | O que é |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Credenciais do banco (escolha uma senha forte). |
| `REDIS_PASSWORD` | Senha do Redis (escolha uma senha forte). |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Duas chaves aleatórias longas (ex.: `openssl rand -hex 32`). |
| `ADMIN_SEED_EMAIL` | E-mail do primeiro login admin. |
| `ADMIN_SEED_SENHA` | Senha do primeiro admin. Se deixar em branco, uma senha aleatória é gerada e aparece nos logs na primeira subida. |

> As integrações de **WhatsApp (Meta)** e **Pix (Mercado Pago)** podem ficar em
> branco no início — o sistema sobe e todo o painel funciona. Só o bot de
> WhatsApp e a cobrança Pix automática ficam inativos até você preencher
> (seção 7).

## 4. SSL (primeira emissão dos certificados)

O `nginx` espera certificados em `nginx/ssl` / Let's Encrypt. Emita os
certificados para os três subdomínios com o `certbot` (uma vez):

```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d app.SEU-DOMINIO -d api.SEU-DOMINIO -d portal.SEU-DOMINIO
```

(Depois disso o serviço `certbot` renova sozinho a cada 12h.)

## 5. Subir o sistema

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

O container **backend** cuida sozinho de:
1. aplicar o schema do banco (`prisma db push`);
2. rodar o seed (cria o admin, as categorias de serviço e os SLAs padrão) —
   é **idempotente**, roda sem risco em toda subida;
3. iniciar a API.

O container **worker** processa as filas (notificações WhatsApp, PDFs,
comissões, Pix, recibos, cobrança recorrente).

## 6. Primeiro login

Se você deixou `ADMIN_SEED_SENHA` em branco, pegue a senha gerada nos logs:

```bash
docker compose -f docker-compose.prod.yml logs backend | grep -A2 "admin inicial"
```

Acesse `https://app.SEU-DOMINIO`, entre com o e-mail/senha do admin e
**troque a senha** em seguida.

## 7. Roteiro de teste (painel)

Sem depender de Meta/Mercado Pago, dá para validar tudo:

- [ ] Login como admin
- [ ] Criar cliente e uma Ordem de Serviço
- [ ] Atribuir técnico, mudar status, gerar o PDF da OS
- [ ] **Laudos**: montar um laudo (inserir modelo, tabela `| ... |`, `[NC]`,
      anexar foto) e gerar o PDF
- [ ] **Contas a Receber**: criar uma conta avulsa e dar baixa
- [ ] **Contratos**: criar um contrato recorrente e usar "Faturar agora"
- [ ] **Minha Rota** / **Rastreio**: registrar "a caminho" e check-in numa OS

## 8. Atualizar o sistema (deploy de uma nova versão)

Na VPS:

```bash
cd globalengenharia-os
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

O schema é reaplicado automaticamente (mudanças aditivas, sem perda de dados).

> **Notas técnicas**
> - Uma mudança de schema **destrutiva** (remover coluna/tabela) faz o
>   `prisma db push` **falhar de propósito** (nunca apaga dados sozinho): o
>   backend entra em reinício e os logs mostram o motivo. Nesses casos raros,
>   aplique a alteração manualmente no banco antes de subir.
> - O `backend` roda como **réplica única** (ele é quem aplica o schema no
>   boot). Não escale o serviço `backend` horizontalmente sem antes migrar
>   para um fluxo de migração com lock.
> - **Passo único de adoção do histórico de migrations** (rode uma vez, na
>   VPS, antes do próximo deploy — não precisa repetir depois):
>   ```bash
>   docker compose -f docker-compose.prod.yml exec backend \
>     npx prisma migrate resolve --applied 20260720221023_baseline_inicial
>   ```
>   Isso não muda nada no banco — só avisa o Prisma que o schema atual já
>   corresponde à migration de baseline, pra ele parar de tentar recriá-la.
>   Sem esse passo, o `prisma migrate deploy` do deploy automático mostra um
>   aviso (não bloqueia o deploy, o `db push` continua aplicando o schema
>   normalmente) até você rodar isso uma vez. Detalhes em
>   `backend/prisma/migrations-legacy/README.md`.

## 9. Integrações externas (quando for ativar)

Preencha no `.env` e rode de novo o passo 8.

### WhatsApp (Meta Cloud API)
- `META_PHONE_NUMBER_ID`, `META_WHATSAPP_TOKEN`, `META_VERIFY_TOKEN`, `META_APP_SECRET`
- No painel da Meta, configure o **webhook**:
  - URL: `https://api.SEU-DOMINIO/webhook/whatsapp`
  - Verify token: o mesmo valor de `META_VERIFY_TOKEN`
- Crie e **aprove** os templates de mensagem e informe os nomes:
  `WHATSAPP_TEMPLATE_PIX_COBRANCA`, `META_TEMPLATE_LEMBRETE_AGENDAMENTO`,
  `META_TEMPLATE_TECNICO_A_CAMINHO`.

### Pix (Mercado Pago)
- `MERCADOPAGO_ACCESS_TOKEN` (e o secret do webhook, se usar validação).
- Configure a **notificação de pagamento** apontando para:
  `https://api.SEU-DOMINIO/webhooks/mercadopago`

## 10. Backup do banco

Faça backups periódicos do PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```

## Comandos úteis

```bash
# Ver o estado dos serviços
docker compose -f docker-compose.prod.yml ps

# Logs (backend, worker, etc.)
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker

# Rodar o seed manualmente (idempotente)
docker compose -f docker-compose.prod.yml exec backend node dist-seed/seed.js

# Reaplicar o schema manualmente
docker compose -f docker-compose.prod.yml exec backend npx prisma db push --skip-generate
```
