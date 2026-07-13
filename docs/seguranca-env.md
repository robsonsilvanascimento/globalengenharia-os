# Segurança de Secrets — Global Engenharia OS

## 1. Gerar o .env de produção

Execute na raiz do projeto (requer `openssl` instalado):

```bash
bash scripts/gerar-env-producao.sh > .env
```

O script gera automaticamente senhas criptograficamente seguras para:
- `POSTGRES_PASSWORD` (base64, 32 bytes)
- `REDIS_PASSWORD` (base64, 24 bytes)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` (base64, 48 bytes — 384 bits)
- `META_VERIFY_TOKEN` (hex, 20 bytes)
- `MERCADOPAGO_WEBHOOK_SECRET` (hex, 32 bytes)
- `ADMIN_SEED_SENHA` (base64, 16 bytes)

> **Importante:** `POSTGRES_PASSWORD` e `DATABASE_URL` são gerados com a mesma senha na mesma execução. Nunca edite um sem atualizar o outro.

---

## 2. Variáveis que exigem preenchimento manual

Após rodar o script, edite o `.env` e preencha:

| Variável | Onde obter |
|---|---|
| `FRONTEND_URL` | Seu domínio de produção |
| `API_URL` | Seu domínio de produção (subdomínio api.) |
| `META_WHATSAPP_TOKEN` | Meta for Developers → WhatsApp → Token de acesso permanente |
| `META_PHONE_NUMBER_ID` | Meta for Developers → WhatsApp → Número de telefone |
| `META_APP_SECRET` | Meta for Developers → Configurações do App → Segredo do app |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud Console → IAM → Conta de serviço → Chave JSON (base64) |
| `MERCADOPAGO_ACCESS_TOKEN` | Painel MercadoPago → Credenciais de produção |

---

## 3. Política de rotação de secrets

| Secret | Frequência recomendada | Procedimento |
|---|---|---|
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | A cada 90 dias | Gerar novo valor, reiniciar backend (invalida sessões ativas) |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | A cada 180 dias ou após incidente | Atualizar DB/Redis + `.env` + reiniciar containers |
| `META_WHATSAPP_TOKEN` | Conforme política Meta (tokens permanentes não expiram, mas revogar se comprometido) | Revogar no painel Meta e gerar novo |
| `ADMIN_SEED_SENHA` | Após o primeiro login do administrador | Trocar pela interface do sistema; a variável pode ser removida após o seed |
| `MERCADOPAGO_ACCESS_TOKEN` | Após mudança de equipe ou incidente | Revogar no painel MercadoPago |

---

## 4. Checklist de segurança antes do deploy

- [ ] `.env` foi gerado com `gerar-env-producao.sh` (nunca copiado de desenvolvimento)
- [ ] `.env` não está rastreado pelo git (`git status` não deve listá-lo)
- [ ] Variáveis manuais preenchidas (`META_*`, domínios, etc.)
- [ ] `ADMIN_SEED_SENHA` anotada em gerenciador de senhas antes do primeiro deploy
- [ ] Script de permissões executado na VPS: `sudo bash scripts/permissoes-vps.sh`
- [ ] Verificar que `chmod 600 .env` foi aplicado: `ls -la /opt/globalengenharia/.env`
- [ ] Backup do `.env` armazenado em local seguro (Bitwarden, Vault, AWS Secrets Manager)
- [ ] Nginx configurado para HTTPS (TLS 1.2+ apenas)
- [ ] Portas do Postgres e Redis não expostas publicamente (rede `internal` do Docker)
- [ ] Firewall da VPS bloqueando portas 5432 e 6379 para o exterior

---

## 5. Regras gerais

- O arquivo `.env` nunca deve ser commitado. O `.gitignore` já o exclui.
- Use `.env.example` (sem valores reais) para documentar as variáveis esperadas pelo projeto.
- Em caso de comprometimento de qualquer secret, rotacione imediatamente e audite os logs de acesso.
