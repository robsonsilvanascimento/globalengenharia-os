# Segredos GitHub Actions — Deploy VPS Hostinger

## Onde configurar

GitHub → repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

---

## Segredos obrigatorios

| Nome do secret | Valor esperado | Exemplo |
|---|---|---|
| `VPS_HOST` | IP publico ou hostname da VPS Hostinger | `185.xxx.xxx.xxx` |
| `VPS_USER` | Usuario SSH da VPS | `root` ou `deploy` |
| `VPS_SSH_KEY` | Chave privada SSH completa (Ed25519) | Bloco `-----BEGIN OPENSSH PRIVATE KEY-----` |

---

## Gerando o par de chaves SSH (rodar localmente, uma unica vez)

```bash
# Gerar chave Ed25519 dedicada para o GitHub Actions
ssh-keygen -t ed25519 -C "github-actions-deploy-globalengenharia" -f ~/.ssh/github_actions_deploy -N ""

# Exibir a chave publica (adicionar na VPS)
cat ~/.ssh/github_actions_deploy.pub

# Exibir a chave privada (adicionar como secret no GitHub)
cat ~/.ssh/github_actions_deploy
```

## Autorizando a chave na VPS

```bash
# Na VPS, como root ou usuario deploy:
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Colar o conteudo de github_actions_deploy.pub no arquivo abaixo:
echo "COLE_A_CHAVE_PUBLICA_AQUI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## Adicionando a chave privada como secret no GitHub

1. Copie TODO o conteudo do arquivo `~/.ssh/github_actions_deploy` (incluindo as linhas `-----BEGIN` e `-----END`).
2. No GitHub: Settings → Secrets and variables → Actions → New repository secret.
3. Nome: `VPS_SSH_KEY`
4. Valor: cole o conteudo copiado.
5. Clique em **Add secret**.

Repita o mesmo processo para `VPS_HOST` e `VPS_USER`.

---

## Environment de protecao (recomendado)

O job `deploy` usa `environment: producao`. Crie este environment no GitHub para adicionar revisores obrigatorios ou regras de protecao de branch:

GitHub → Settings → Environments → **New environment** → nome: `producao`

---

## Testando a conexao SSH manualmente

```bash
ssh -i ~/.ssh/github_actions_deploy -o StrictHostKeyChecking=no SEU_USER@SEU_VPS_IP "echo OK"
```

Se retornar `OK`, a chave esta configurada corretamente.
