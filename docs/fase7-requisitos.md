# Fase 7 — Requisitos: Infraestrutura, Integrações e API Pública
**Sistema de Gestão de OS — Global Engenharia**
Data: 2026-07-13

---

## US-01 — Dockerfiles otimizados para backend e frontend

**Como** desenvolvedor,
**quero** Dockerfiles otimizados com multi-stage build para o backend (Fastify/Node) e o frontend (React),
**para** reduzir o tamanho das imagens em produção e isolar dependências de build.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Build do backend bem-sucedido**
- **Given** que o Dockerfile do backend usa multi-stage (build + production)
- **When** o comando `docker build -t gea-backend .` é executado no diretório do backend
- **Then** a imagem é criada sem erro e contém apenas as dependências de produção (`node_modules` de produção, arquivos compilados)
- **And** o tamanho da imagem final é inferior a 300 MB

**Cenário 2 — Build do frontend bem-sucedido**
- **Given** que o Dockerfile do frontend usa multi-stage (build com Node + serving com nginx)
- **When** o comando `docker build -t gea-frontend .` é executado no diretório do frontend
- **Then** a imagem é criada e serve os arquivos estáticos via nginx na porta 80
- **And** o tamanho da imagem final é inferior a 100 MB

**Cenário 3 — Usuário não-root**
- **Given** que o container é iniciado
- **When** o processo principal é inspecionado
- **Then** ele não roda como root (UID != 0)

### Regras de Negócio
- O stage de build não deve estar presente na imagem final
- `.dockerignore` deve excluir `node_modules`, `.git`, arquivos de teste e `.env`

---

## US-02 — docker-compose.yml de produção

**Como** desenvolvedor,
**quero** um `docker-compose.yml` de produção orquestrando nginx, backend, frontend, PostgreSQL e Redis,
**para** subir todo o ambiente com um único comando e garantir a comunicação segura entre serviços.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Todos os serviços sobem**
- **Given** que as variáveis de ambiente do `.env` estão preenchidas
- **When** `docker compose up -d` é executado
- **Then** todos os cinco serviços (nginx, backend, frontend, postgres, redis) ficam com status `healthy` em até 60 segundos

**Cenário 2 — Backend acessa banco e cache**
- **Given** que os serviços estão rodando
- **When** o backend realiza uma requisição autenticada à rota `/health`
- **Then** a resposta retorna HTTP 200 com `{"db":"ok","redis":"ok"}`

**Cenário 3 — Nginx roteia corretamente**
- **Given** que o nginx está configurado com subdomínios
- **When** uma requisição chega em `api.<dominio>`
- **Then** é encaminhada ao serviço backend na porta interna
- **When** uma requisição chega em `app.<dominio>`
- **Then** é encaminhada ao serviço frontend na porta interna

**Cenário 4 — Persistência de dados**
- **Given** que volumes nomeados estão definidos para postgres e redis
- **When** o compose é reiniciado com `docker compose restart`
- **Then** os dados do banco e do cache são preservados

**Cenário 5 — Rede isolada**
- **Given** que os serviços estão em uma rede interna docker
- **When** inspecionado
- **Then** apenas o serviço nginx expõe portas para o host (80 e 443); backend e frontend não expõem portas diretamente

### Regras de Negócio
- PostgreSQL e Redis não devem ter portas expostas para fora da rede Docker
- O nginx deve ser responsável por SSL termination (certificados via Let's Encrypt ou mapeamento de volume com certs existentes)
- `restart: unless-stopped` em todos os serviços

---

## US-03 — Pipeline GitHub Actions com deploy via SSH

**Como** desenvolvedor,
**quero** um pipeline no GitHub Actions que execute build, testes e deploy automatizado via SSH no servidor Hostinger,
**para** garantir entrega contínua sem acesso manual ao servidor.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Pipeline disparado em push para `main`**
- **Given** que um push é feito na branch `main`
- **When** o GitHub Actions é acionado
- **Then** as etapas são executadas na ordem: checkout → install → lint → testes → build → deploy

**Cenário 2 — Falha nos testes bloqueia o deploy**
- **Given** que um teste unitário ou de integração falha
- **When** a etapa de testes é executada
- **Then** o pipeline para na etapa de testes e o deploy NÃO é realizado
- **And** o status do commit fica marcado como `failure` no GitHub

**Cenário 3 — Deploy via SSH bem-sucedido**
- **Given** que todos os testes passam e o build é gerado
- **When** a etapa de deploy é executada
- **Then** o pipeline conecta ao servidor via SSH usando secret `SSH_PRIVATE_KEY` e `SSH_HOST`
- **And** executa `docker compose pull && docker compose up -d --remove-orphans` no servidor
- **And** o pipeline termina com status `success`

**Cenário 4 — Secrets obrigatórias presentes**
- **Given** que as secrets `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER` e `SSH_PORT` estão configuradas no repositório
- **When** o pipeline roda
- **Then** a conexão SSH é estabelecida sem expor valores de secrets nos logs

### Regras de Negócio
- O pipeline deve usar cache de dependências (`node_modules`) para acelerar builds
- Secrets nunca devem ser impressas em logs (`no-echo`)
- A etapa de deploy só ocorre em push para `main`; PRs apenas executam build e testes

---

## US-04 — Backup automático diário do PostgreSQL para Google Drive

**Como** administrador,
**quero** que o banco PostgreSQL seja exportado automaticamente todo dia e enviado ao Google Drive,
**para** garantir recuperação de dados em caso de falha sem intervenção manual.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Backup gerado diariamente**
- **Given** que um cron job está configurado para rodar às 02:00 (horário do servidor)
- **When** o horário programado chega
- **Then** um dump `.sql.gz` é gerado com o nome no formato `backup_YYYY-MM-DD_HH-mm.sql.gz`

**Cenário 2 — Arquivo enviado ao Google Drive**
- **Given** que o dump foi gerado com sucesso
- **When** o script de upload é executado
- **Then** o arquivo é enviado à pasta configurada no Google Drive da conta de serviço
- **And** um log de confirmação com timestamp e tamanho do arquivo é gravado em `/var/log/gea-backup.log`

**Cenário 3 — Falha de backup gera alerta**
- **Given** que o dump ou o upload falha por qualquer motivo
- **When** o script detecta o erro (exit code != 0)
- **Then** uma entrada de erro é gravada no log com detalhes
- **And** um e-mail de alerta é enviado ao endereço configurado em `BACKUP_ALERT_EMAIL`

**Cenário 4 — Retenção de backups**
- **Given** que backups anteriores existem no Google Drive
- **When** um novo backup é enviado
- **Then** backups com mais de 30 dias são removidos automaticamente da pasta

### Regras de Negócio
- O backup usa `pg_dump` com compressão gzip
- A autenticação com Google Drive usa conta de serviço (Service Account JSON) — a mesma utilizada pelo Google Calendar, se habilitado
- A variável `BACKUP_GOOGLE_DRIVE_FOLDER_ID` indica a pasta de destino

---

## US-05 — Arquivo `.env.example` completo e documentado

**Como** administrador ou desenvolvedor novo no projeto,
**quero** um arquivo `.env.example` com todas as variáveis de ambiente documentadas,
**para** configurar o ambiente sem depender de conhecimento prévio ou de outro membro da equipe.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Todas as variáveis presentes**
- **Given** que o arquivo `.env.example` existe na raiz do projeto
- **When** um desenvolvedor o consulta
- **Then** todas as variáveis usadas no código (lidas via `process.env`) estão listadas no arquivo
- **And** nenhuma variável real (valor de produção) está presente — apenas placeholders ou exemplos fictícios

**Cenário 2 — Variáveis agrupadas e comentadas**
- **Given** que o arquivo é aberto
- **When** lido
- **Then** as variáveis estão agrupadas por seção (ex: `# Banco de dados`, `# Redis`, `# Google Calendar`, `# API Pública`, `# Backup`, `# Email`)
- **And** cada variável possui comentário explicando seu propósito e valores aceitos

**Cenário 3 — Flags booleanas documentadas**
- **Given** que existem flags como `GOOGLE_CALENDAR_ENABLED`
- **When** lidas no `.env.example`
- **Then** o comentário indica os valores aceitos (`true` | `false`) e o comportamento de cada um

### Regras de Negócio
- O arquivo `.env` real deve estar no `.gitignore`
- Toda nova variável adicionada ao sistema em fases futuras deve ser incluída no `.env.example` na mesma PR

---

## US-06 — Criação de evento no Google Calendar ao atribuir técnico a uma OS

**Como** técnico,
**quero** que um evento seja criado automaticamente no meu Google Calendar quando sou atribuído a uma OS com data e hora definidas,
**para** visualizar minha agenda de serviços sem precisar acessar o sistema.

**Prioridade:** MVP (quando `GOOGLE_CALENDAR_ENABLED=true`)

### Critérios de Aceitação (BDD)

**Cenário 1 — Evento criado com sucesso**
- **Given** que `GOOGLE_CALENDAR_ENABLED=true` está configurado
- **And** uma OS possui `data_agendamento` e `hora_agendamento` preenchidos
- **When** um técnico é atribuído à OS
- **Then** um evento é criado no Google Calendar do técnico via conta de serviço
- **And** o evento contém: título (`OS #<numero> — <titulo_os>`), data/hora de início, duração padrão de 1 hora, descrição com endereço e descrição da OS, e link para a OS no sistema (`app.<dominio>/os/<id>`)
- **And** o `google_event_id` retornado pela API do Google é salvo no registro da OS no banco

**Cenário 2 — Google Calendar desabilitado**
- **Given** que `GOOGLE_CALENDAR_ENABLED=false`
- **When** um técnico é atribuído à OS
- **Then** nenhuma chamada à API do Google é realizada
- **And** o fluxo principal de atribuição conclui normalmente sem erro

**Cenário 3 — Técnico sem e-mail Google cadastrado**
- **Given** que o técnico não possui e-mail Google válido no cadastro
- **When** a atribuição ocorre
- **Then** o evento não é criado
- **And** um aviso é registrado no log (`warn`) sem interromper a operação

**Cenário 4 — Falha na API do Google**
- **Given** que a API do Google retorna erro (timeout, quota, etc.)
- **When** a tentativa de criação do evento falha
- **Then** o erro é registrado no log mas a atribuição da OS é concluída normalmente (falha silenciosa não bloqueante)

### Regras de Negócio
- A integração usa Service Account com domínio delegado (Domain-Wide Delegation) ou convite via e-mail do técnico
- O campo `google_event_id` na tabela `ordens_servico` armazena o ID do evento para operações futuras
- Duração padrão do evento: 1 hora (configurável via `GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES`)

---

## US-07 — Atualização de evento no Google Calendar ao alterar data/hora da OS

**Como** técnico,
**quero** que o evento no meu Google Calendar seja atualizado automaticamente se a data ou hora da OS for alterada,
**para** manter minha agenda sempre sincronizada com o sistema.

**Prioridade:** MVP (quando `GOOGLE_CALENDAR_ENABLED=true`)

### Critérios de Aceitação (BDD)

**Cenário 1 — Evento atualizado ao alterar data/hora**
- **Given** que uma OS possui `google_event_id` preenchido
- **And** `GOOGLE_CALENDAR_ENABLED=true`
- **When** a `data_agendamento` ou `hora_agendamento` da OS é alterada
- **Then** a API do Google é chamada com PATCH/PUT no evento identificado por `google_event_id`
- **And** o evento reflete a nova data e hora em até 5 segundos

**Cenário 2 — Evento sem ID cadastrado**
- **Given** que a OS não possui `google_event_id` (evento nunca foi criado)
- **When** a data/hora é alterada
- **Then** uma tentativa de criação de novo evento é feita, seguindo as mesmas regras da US-06

**Cenário 3 — Falha na atualização**
- **Given** que a API do Google retorna erro ao atualizar
- **When** a tentativa falha
- **Then** o erro é logado e a atualização da OS no banco é concluída normalmente

### Regras de Negócio
- Apenas alterações em `data_agendamento` ou `hora_agendamento` disparam a sincronização
- Alterações em outros campos (descrição, status) não disparam atualização de calendário nesta fase

---

## US-08 — Remoção de evento no Google Calendar ao cancelar OS

**Como** técnico,
**quero** que o evento seja removido do meu Google Calendar quando a OS é cancelada,
**para** não ter compromissos fantasmas na minha agenda.

**Prioridade:** MVP (quando `GOOGLE_CALENDAR_ENABLED=true`)

### Critérios de Aceitação (BDD)

**Cenário 1 — Evento removido ao cancelar OS**
- **Given** que uma OS possui `google_event_id` preenchido
- **And** `GOOGLE_CALENDAR_ENABLED=true`
- **When** o status da OS é alterado para `CANCELADA`
- **Then** a API do Google é chamada para deletar o evento identificado por `google_event_id`
- **And** o campo `google_event_id` é limpo (`null`) no registro da OS

**Cenário 2 — Evento já inexistente no Google**
- **Given** que o evento foi deletado manualmente no Google Calendar
- **When** o sistema tenta deletar via API e recebe erro 404
- **Then** o erro 404 é ignorado (idempotência) e o campo `google_event_id` é limpo normalmente

**Cenário 3 — Google Calendar desabilitado**
- **Given** que `GOOGLE_CALENDAR_ENABLED=false`
- **When** a OS é cancelada
- **Then** nenhuma chamada à API do Google é realizada

### Regras de Negócio
- Apenas a transição de status para `CANCELADA` dispara a remoção
- Outras transições de status (ex: `CONCLUIDA`) não removem o evento

---

## US-09 — Exportação de relatório de OS em Excel

**Como** administrador,
**quero** exportar um relatório de ordens de serviço em formato Excel com filtros por período, técnico, status e categoria,
**para** analisar a operação e compartilhar dados com a gestão.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Exportação com filtros válidos**
- **Given** que o administrador acessa a tela de relatórios e informa filtros (período obrigatório, demais opcionais)
- **When** clica em "Exportar Excel"
- **Then** o sistema retorna um arquivo `.xlsx` para download em até 10 segundos
- **And** o arquivo contém todas as OS que correspondem aos filtros aplicados

**Cenário 2 — Estrutura do arquivo Excel**
- **Given** que o arquivo é aberto
- **When** inspecionado
- **Then** a primeira linha contém o logo da Global Engenharia e o título do relatório com o período
- **And** a segunda linha contém os cabeçalhos das colunas: Nº OS, Título, Cliente, Técnico, Categoria, Status, Data Abertura, Data Conclusão, Valor
- **And** as células de status são coloridas conforme a paleta definida (ex: verde para `CONCLUIDA`, vermelho para `CANCELADA`, amarelo para `EM_ANDAMENTO`)
- **And** a última linha contém totalizadores (quantidade e valor total)

**Cenário 3 — Nenhum resultado encontrado**
- **Given** que os filtros aplicados não retornam nenhuma OS
- **When** o export é solicitado
- **Then** o arquivo é gerado com cabeçalho e a mensagem "Nenhum registro encontrado para os filtros selecionados" na primeira linha de dados

**Cenário 4 — Filtro por período obrigatório**
- **Given** que o administrador não informa o período (data início e data fim)
- **When** tenta exportar
- **Then** o sistema exibe mensagem de validação "Informe o período para exportação" e não gera o arquivo

### Regras de Negócio
- Geração via ExcelJS no backend
- Logo da Global Engenharia inserido como imagem no cabeçalho da planilha
- Cores por status: `CONCLUIDA` → verde (`#27AE60`), `CANCELADA` → vermelho (`#E74C3C`), `EM_ANDAMENTO` → amarelo (`#F39C12`), `ABERTA` → azul (`#2980B9`), `PENDENTE` → cinza (`#95A5A6`)
- O período máximo por exportação é de 12 meses
- Apenas usuários com papel `ADMIN` ou `GESTOR` podem exportar

---

## US-10 — Exportação de relatório financeiro em Excel

**Como** administrador,
**quero** exportar um relatório financeiro em Excel com receita, pagamentos e comissões por período,
**para** fechar o caixa e calcular repasses aos técnicos.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Exportação financeira com período válido**
- **Given** que o administrador informa período (data início e data fim)
- **When** clica em "Exportar Relatório Financeiro"
- **Then** o arquivo `.xlsx` é gerado e disponibilizado para download em até 15 segundos

**Cenário 2 — Estrutura do arquivo financeiro**
- **Given** que o arquivo é aberto
- **When** inspecionado
- **Then** contém três abas: "Resumo", "Pagamentos" e "Comissões"
- **And** a aba "Resumo" exibe: total de OS concluídas, receita bruta, total de descontos, receita líquida
- **And** a aba "Pagamentos" lista cada pagamento com: Nº OS, Cliente, Forma de Pagamento, Valor, Data
- **And** a aba "Comissões" lista por técnico: nome, quantidade de OS, valor total, percentual de comissão, valor a receber
- **And** o cabeçalho de todas as abas contém logo e período do relatório

**Cenário 3 — Relatório sem movimentação**
- **Given** que não há pagamentos no período informado
- **When** o export é solicitado
- **Then** o arquivo é gerado com totais zerados e mensagem "Sem movimentação no período"

### Regras de Negócio
- As mesmas regras de cor e logo da US-09 se aplicam
- Apenas usuários com papel `ADMIN` podem exportar o relatório financeiro
- O percentual de comissão por técnico é lido do cadastro de funcionários

---

## US-11 — Geração de chaves de API para integração com ERP

**Como** administrador,
**quero** gerar chaves de API para conceder acesso controlado ao sistema para integrações externas (ERP),
**para** permitir integrações seguras sem expor credenciais de usuários internos.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Geração de chave bem-sucedida**
- **Given** que o administrador acessa a seção "Integrações > Chaves de API"
- **When** clica em "Gerar nova chave" e informa um nome/descrição
- **Then** o sistema gera uma chave no formato `gea_<64 caracteres hexadecimais>` (prefixo `gea_` + 32 bytes hex)
- **And** a chave é exibida uma única vez na tela com aviso "Guarde esta chave agora. Ela não será exibida novamente."
- **And** no banco, apenas o hash SHA-256 da chave é armazenado (nunca o valor original)

**Cenário 2 — Listagem de chaves**
- **Given** que chaves foram geradas anteriormente
- **When** o administrador acessa a listagem
- **Then** visualiza: nome, data de criação, data do último uso, status (ativa/revogada) — mas nunca o valor da chave

**Cenário 3 — Revogação de chave**
- **Given** que uma chave está ativa
- **When** o administrador clica em "Revogar"
- **Then** a chave é marcada como `revogada` no banco
- **And** qualquer requisição usando essa chave passa a retornar HTTP 401 imediatamente

**Cenário 4 — Limite de chaves ativas**
- **Given** que já existem 10 chaves ativas
- **When** o administrador tenta gerar uma nova
- **Then** o sistema exibe mensagem "Limite de 10 chaves ativas atingido. Revogue uma chave antes de criar nova."

### Regras de Negócio
- Formato: `gea_` + `crypto.randomBytes(32).toString('hex')` = total de 69 caracteres
- Armazenamento: `SHA-256(chave_completa)` no banco — nunca o plaintext
- A chave só é exibida na tela no momento da criação
- Apenas usuários com papel `ADMIN` podem gerenciar chaves

---

## US-12 — Consulta de OS via API pública autenticada por chave

**Como** integrador de sistema ERP,
**quero** consultar ordens de serviço via API REST autenticada por chave,
**para** sincronizar dados de OS com o ERP sem acesso ao painel administrativo.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Consulta autenticada com sucesso**
- **Given** que o integrador possui uma chave de API válida e ativa
- **When** faz GET em `/api/public/v1/os` com o header `X-API-Key: gea_<chave>`
- **Then** recebe HTTP 200 com lista paginada de OS em JSON
- **And** o campo `ultimo_uso` da chave é atualizado no banco

**Cenário 2 — Chave inválida ou revogada**
- **Given** que a chave informada não existe ou foi revogada
- **When** a requisição chega
- **Then** retorna HTTP 401 com `{"error": "Chave de API inválida ou revogada"}`

**Cenário 3 — Rate limit atingido**
- **Given** que o integrador realizou 100 requisições no último minuto com a mesma chave
- **When** a 101ª requisição chega
- **Then** retorna HTTP 429 com header `Retry-After: 60` e `{"error": "Limite de requisições atingido"}`

**Cenário 4 — Filtros disponíveis**
- **Given** que a chave é válida
- **When** faz GET em `/api/public/v1/os?status=CONCLUIDA&data_inicio=2026-01-01&data_fim=2026-06-30&page=1&limit=50`
- **Then** retorna apenas OS com o status e período informados, paginadas corretamente

**Cenário 5 — Consulta de OS específica**
- **Given** que a chave é válida
- **When** faz GET em `/api/public/v1/os/:id`
- **Then** retorna HTTP 200 com os dados da OS ou HTTP 404 se não encontrada

### Regras de Negócio
- Rate limit: 100 requisições/minuto por chave, controlado via Redis (sliding window)
- A autenticação é feita por SHA-256 da chave recebida comparado com o hash armazenado
- O payload retornado é um subconjunto seguro dos dados (sem dados financeiros internos sensíveis)
- Paginação padrão: `limit=20`, máximo: `limit=100`
- Endpoints disponíveis: `GET /api/public/v1/os`, `GET /api/public/v1/os/:id`

---

## US-13 — Consulta de clientes via API pública autenticada por chave

**Como** integrador de sistema ERP,
**quero** consultar clientes cadastrados via API REST autenticada por chave,
**para** manter a base de clientes do ERP sincronizada com o sistema de OS.

**Prioridade:** MVP

### Critérios de Aceitação (BDD)

**Cenário 1 — Consulta de clientes autenticada**
- **Given** que o integrador possui chave de API válida e ativa
- **When** faz GET em `/api/public/v1/clientes` com header `X-API-Key: gea_<chave>`
- **Then** retorna HTTP 200 com lista paginada de clientes

**Cenário 2 — Busca por documento**
- **Given** que a chave é válida
- **When** faz GET em `/api/public/v1/clientes?cpf_cnpj=12345678000195`
- **Then** retorna o cliente correspondente ou lista vazia se não encontrado

**Cenário 3 — Consulta de cliente específico**
- **Given** que a chave é válida
- **When** faz GET em `/api/public/v1/clientes/:id`
- **Then** retorna HTTP 200 com os dados do cliente ou HTTP 404 se não encontrado

**Cenário 4 — Autenticação e rate limit**
- **Given** que as mesmas regras de autenticação e rate limit da US-12 se aplicam
- **When** a chave é inválida ou o limite é atingido
- **Then** retorna HTTP 401 ou HTTP 429 respectivamente, com as mesmas mensagens de erro

### Regras de Negócio
- As mesmas regras de autenticação (SHA-256 + header `X-API-Key`) e rate limit (100 req/min via Redis) da US-12 se aplicam integralmente
- O payload de cliente retornado exclui dados internos como `senha` e campos de auditoria interna
- Endpoints disponíveis: `GET /api/public/v1/clientes`, `GET /api/public/v1/clientes/:id`
- A rota de clientes deve ser explicitamente habilitada na chave no momento da geração (escopo da chave): `["os:read", "clientes:read"]`

---

## Ambiguidades e Perguntas para o Usuário Final

As seguintes questões precisam ser respondidas antes ou durante a implementação:

1. **Google Calendar — modelo de autenticação:** A integração usará Domain-Wide Delegation (requer Google Workspace corporativo) ou convite via e-mail (funciona com Gmail comum)? Isso determina a configuração da Service Account.

2. **Google Calendar — qual calendário do técnico?** O evento deve ser criado no calendário principal do e-mail do técnico ou em um calendário compartilhado da empresa?

3. **Backup — conta Google Drive:** O backup usa a mesma Service Account do Google Calendar ou uma conta separada? A pasta de destino no Drive já existe?

4. **API Pública — escopo por chave:** Cada chave de API deve ter escopos configuráveis (ex: só OS, só clientes, ambos) ou todas as chaves têm acesso a todos os endpoints públicos?

5. **Excel — logo:** O arquivo de logo da Global Engenharia já está disponível no repositório? Em qual formato (PNG recomendado) e dimensões?

6. **Comissões (US-10):** O percentual de comissão é um campo único por técnico ou varia por tipo de OS/categoria?

7. **SSL/Certificados (US-02):** O nginx deve usar Let's Encrypt com Certbot automatizado ou os certificados são provisionados externamente e mapeados como volume?

---

## Resumo de Prioridades

| US | Descrição | Prioridade |
|----|-----------|------------|
| US-01 | Dockerfiles otimizados | MVP |
| US-02 | docker-compose.yml de produção | MVP |
| US-03 | Pipeline GitHub Actions + deploy SSH | MVP |
| US-04 | Backup diário PostgreSQL → Google Drive | MVP |
| US-05 | `.env.example` documentado | MVP |
| US-06 | Criar evento Google Calendar | MVP |
| US-07 | Atualizar evento Google Calendar | MVP |
| US-08 | Remover evento Google Calendar | MVP |
| US-09 | Exportar OS em Excel | MVP |
| US-10 | Exportar financeiro em Excel | MVP |
| US-11 | Gerar chaves de API | MVP |
| US-12 | API pública — consulta OS | MVP |
| US-13 | API pública — consulta clientes | MVP |
