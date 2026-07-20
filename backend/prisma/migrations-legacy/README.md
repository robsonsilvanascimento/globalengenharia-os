# Migrations legadas (pré-baseline)

Estes arquivos `.sql` foram usados manualmente (fora do fluxo do Prisma Migrate)
para evoluir o schema antes da migration `20260720221023_baseline_inicial`.
Eles não têm mais efeito automático — ficam aqui só como histórico de quais
mudanças de schema aconteceram e quando.

A partir da baseline, todo o schema atual (incluindo o que estes arquivos
adicionaram) já está coberto por `prisma/migrations/20260720221023_baseline_inicial/migration.sql`,
gerado diretamente de `schema.prisma` e validado do zero num banco vazio.

**Antes do próximo deploy em produção**, é necessário rodar uma única vez,
contra o banco de produção real:

```bash
npx prisma migrate resolve --applied 20260720221023_baseline_inicial
```

Isso diz ao Prisma "esse schema já existe aí, não tente recriar — só passa a
rastrear migrations novas a partir daqui". Sem esse passo, `prisma migrate
deploy` (rodado pelo `.github/workflows/deploy.yml`) vai tentar aplicar a
baseline inteira num banco que já tem essas tabelas, e vai falhar.
