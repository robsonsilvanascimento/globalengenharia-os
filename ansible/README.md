# Infraestrutura como Código — provisionamento da VPS

Este playbook Ansible é uma tradução direta do guia manual em
[`docs/primeiro-deploy.md`](../docs/primeiro-deploy.md) — os mesmos comandos que já
estavam documentados, agora automatizados e idempotentes (rodar de novo não
duplica nada nem quebra um servidor já provisionado).

**Importante — leia antes de rodar:** este playbook não foi executado contra uma VPS de
verdade (não tenho acesso a nenhuma nesta sessão) — só validei a sintaxe YAML.
Trate a primeira execução como faria com o guia manual: rode num servidor de
teste antes de confiar nele em produção, e revise o que cada tarefa faz.

## Uso

```bash
cd ansible
cp inventory.example.ini inventory.ini   # nunca commitar o inventory.ini real
# preencha ansible_host, deploy_ssh_public_key, repo_url, dominios

# 1. Provisionamento (docker, usuário deploy, firewall, clone do repo)
ansible-playbook -i inventory.ini site.yml

# Depois de preencher o .env de verdade na VPS (a task avisa onde):

# 2. Subir os serviços
ansible-playbook -i inventory.ini site.yml --tags deploy

# 3. Migrations iniciais do banco
ansible-playbook -i inventory.ini site.yml --tags migrations

# 4. SSL — só depois do DNS já apontar pro IP da VPS
ansible-playbook -i inventory.ini site.yml --tags ssl
```

## Por que os passos 2-4 não rodam por padrão

`deploy`, `migrations` e `ssl` ficam marcados com a tag especial `never` — só
rodam se você pedir explicitamente com `--tags`. Cada um depende de um estado
que o playbook não tem como verificar sozinho com segurança (`.env` já
preenchido com segredos reais, banco já de pé, DNS já propagado) — errar a
ordem aqui é pior do que exigir um passo manual a mais.

## O que este playbook NÃO cobre

- **Deploy contínuo** (push → CI → deploy automático) continua sendo o
  `.github/workflows/deploy.yml` existente — este playbook é só pro
  provisionamento inicial da VPS, um único servidor.
- **Backup do banco** — ver `DEPLOY.md`, seção 10.
- **Múltiplos servidores / alta disponibilidade** — o projeto hoje roda numa
  única VPS (ver nota em `DEPLOY.md` sobre o backend rodar como réplica
  única); isto não é um setup de cluster.
