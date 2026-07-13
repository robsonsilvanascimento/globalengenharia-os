# Fase 5 — Requisitos: Pagamentos, Comissões e Dashboard Financeiro
## Sistema de Gestão de OS — Global Engenharia

---

## Contexto

A Fase 5 adiciona ao sistema a camada financeira completa: cobrança via Pix (Mercado Pago), registro de pagamentos manuais, cálculo automático de comissão de técnicos e painel financeiro com indicadores de receita e inadimplência.

Campos novos relevantes:
- `OS.status_pagamento`: enum `pendente | pago | cancelado`
- `OS.valor_cobrado`: já existe
- `Tecnico.comissao_ativa`: boolean
- `Tecnico.comissao_pct`: float (percentual)

---

## User Stories — MVP

---

### US-01 — Geração automática de link Pix ao concluir OS

**Como** admin,
**quero** que um link Pix seja gerado automaticamente quando uma OS é marcada como concluída,
**para** facilitar a cobrança sem precisar acessar outro sistema.

**Critérios de Aceitação (BDD):**

```
Cenário 1: OS concluída com valor_cobrado definido
  Given uma OS com status "em_andamento" e valor_cobrado > 0
  When o admin marca a OS como "concluída"
  Then o sistema deve gerar um Pix via Mercado Pago com valor = valor_cobrado da OS
  And o link Pix deve ser salvo no registro da OS
  And o Pix deve ter validade de 24 horas
  And o status_pagamento da OS deve permanecer "pendente"

Cenário 2: OS concluída sem valor_cobrado
  Given uma OS com status "em_andamento" e valor_cobrado = 0 ou nulo
  When o admin marca a OS como "concluída"
  Then o sistema NÃO deve gerar Pix
  And deve exibir alerta: "Informe o valor cobrado antes de concluir"

Cenário 3: Falha na API do Mercado Pago
  Given uma OS sendo concluída
  When a API do Mercado Pago retornar erro
  Then a OS deve ser marcada como concluída mesmo assim
  And o status_pagamento deve ser "pendente"
  And o sistema deve registrar o erro em log
  And deve exibir aviso ao admin: "Pix não gerado — tente gerar manualmente"
```

**Regras de negócio:**
- Valor do Pix = `OS.valor_cobrado` (sem arredondamentos adicionais)
- Expiração: 24 horas (configurado na chamada à API do Mercado Pago)
- Um único Pix ativo por OS; Pix expirado não bloqueia geração de novo

---

### US-02 — Confirmação de pagamento via webhook

**Como** admin,
**quero** receber confirmação automática de pagamento via webhook do Mercado Pago,
**para** que o status da OS seja atualizado sem intervenção manual.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Webhook válido de pagamento aprovado
  Given o Mercado Pago envia notificação de pagamento ao endpoint de webhook
  And a assinatura do webhook é válida (HMAC verificado)
  And o ID do pagamento corresponde a uma OS existente
  When o sistema processa a notificação
  Then o status_pagamento da OS deve ser atualizado para "pago"
  And deve ser registrada a data e hora do pagamento
  And a comissão do técnico deve ser calculada automaticamente (se comissao_ativa = true)
  And o sistema deve responder HTTP 200 ao Mercado Pago

Cenário 2: Webhook com assinatura inválida
  Given o Mercado Pago (ou terceiro) envia notificação ao endpoint de webhook
  And a assinatura HMAC não corresponde ao secret configurado
  When o sistema recebe a requisição
  Then deve rejeitar sem processar e responder HTTP 401
  And deve registrar tentativa inválida em log de segurança

Cenário 3: Webhook de pagamento cancelado ou estornado
  Given o Mercado Pago envia notificação de status "cancelled" ou "refunded"
  And a assinatura é válida
  When o sistema processa a notificação
  Then o status_pagamento da OS deve ser atualizado para "cancelado"
  And a comissão previamente calculada deve ser estornada (zerada) se ainda não paga ao técnico

Cenário 4: OS não encontrada pelo ID do pagamento
  Given webhook válido chega com referência externa desconhecida
  When o sistema tenta localizar a OS
  Then deve responder HTTP 200 (para não gerar reenvio pelo Mercado Pago)
  And deve registrar o evento em log de inconsistências
```

**Regras de negócio:**
- Validação de assinatura obrigatória antes de qualquer processamento
- O endpoint de webhook não deve exigir autenticação de usuário (é chamado pelo Mercado Pago)
- Idempotência: processamento duplicado do mesmo evento não deve alterar o estado já "pago"

---

### US-03 — Envio do link Pix via WhatsApp

**Como** cliente,
**quero** receber o link Pix via WhatsApp quando minha OS for concluída,
**para** poder pagar com facilidade sem precisar solicitar o link.

**Critérios de Aceitação (BDD):**

```
Cenário 1: OS concluída com telefone de cliente cadastrado
  Given uma OS é marcada como concluída
  And o Pix foi gerado com sucesso
  And o cliente possui telefone cadastrado
  When o sistema finaliza o processo de conclusão da OS
  Then deve enviar mensagem via WhatsApp ao telefone do cliente
  And a mensagem deve conter: número da OS, valor, link Pix e prazo de validade (24h)

Cenário 2: Cliente sem telefone cadastrado
  Given uma OS é concluída
  And o cliente não possui telefone cadastrado
  When o sistema tenta enviar o WhatsApp
  Then não deve enviar mensagem
  And deve exibir aviso ao admin: "Cliente sem telefone — envie o link manualmente"
  And o link Pix deve estar visível na tela da OS para cópia manual

Cenário 3: Falha no envio WhatsApp
  Given o serviço de WhatsApp retorna erro
  When o sistema tenta enviar
  Then a OS deve permanecer concluída normalmente
  And deve registrar falha em log
  And exibir alerta ao admin com o link Pix para envio manual
```

**Regras de negócio:**
- Envio via WhatsApp é dependente do Pix ter sido gerado com sucesso
- Falha no WhatsApp não deve reverter nem bloquear a conclusão da OS

**Ambiguidade a resolver com o cliente:**
- Qual provedor de WhatsApp será usado? (Twilio, Z-API, Evolution API, outro?)
- A mensagem deve ter template fixo ou o admin pode personalizar?

---

### US-04 — Registro de pagamento manual

**Como** admin,
**quero** registrar um pagamento manual informando valor recebido e observação,
**para** registrar cobranças feitas em dinheiro, transferência ou outros meios.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Registro válido de pagamento manual
  Given uma OS com status_pagamento "pendente"
  When o admin acessa "Registrar pagamento manual"
  And informa valor recebido > 0 e forma de pagamento (dinheiro/transferência/outro)
  And confirma o registro
  Then o status_pagamento deve ser atualizado para "pago"
  And deve ser registrado: valor, forma de pagamento, observação, admin responsável e data/hora
  And a comissão do técnico deve ser calculada automaticamente (se comissao_ativa = true)

Cenário 2: Valor informado diferente do valor_cobrado
  Given o admin informa um valor diferente do valor_cobrado da OS
  When confirma o registro
  Then o sistema deve salvar o valor efetivamente recebido
  And registrar a diferença como observação automática ("Valor cobrado: R$ X — Valor recebido: R$ Y")
  And calcular a comissão sobre o valor efetivamente recebido

Cenário 3: OS já marcada como paga
  Given uma OS com status_pagamento "pago"
  When o admin tenta registrar pagamento manual
  Then o sistema deve bloquear a ação
  And exibir mensagem: "Esta OS já está marcada como paga"
```

**Regras de negócio:**
- Pagamento manual não cancela Pix eventualmente gerado
- Campos obrigatórios: valor recebido, forma de pagamento
- Campo opcional: observação (texto livre)

---

### US-05 — Marcar OS como paga manualmente sem gerar Pix

**Como** admin,
**quero** marcar uma OS como paga manualmente sem necessidade de gerar link Pix,
**para** registrar pagamentos recebidos fora do fluxo digital.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Marcação manual sem Pix
  Given uma OS com status_pagamento "pendente"
  When o admin seleciona "Marcar como pago (sem Pix)"
  And confirma a ação
  Then o status_pagamento deve ser "pago"
  And deve ser registrada a ação com admin responsável e data/hora

Cenário 2: OS com Pix ativo ao ser marcada manualmente como paga
  Given uma OS com Pix gerado e ainda válido
  When o admin marca como pago manualmente
  Then o Pix deve ser cancelado via API do Mercado Pago (se a API permitir)
  And o status_pagamento deve ser "pago"
```

**Nota:** US-04 e US-05 podem ser consolidadas em uma única interface de "Registrar Pagamento Manual" — decisão de UX a cargo do Arquiteto/Frontend Lead.

---

### US-06 — Configurar comissão por técnico

**Como** admin,
**quero** ativar ou desativar a comissão de um técnico e definir o percentual,
**para** controlar quais técnicos participam do programa de comissão e com quais taxas.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Ativar comissão de técnico
  Given o admin acessa o cadastro de um técnico
  When ativa o campo comissao_ativa = true
  And informa comissao_pct (ex: 10.5)
  And salva
  Then o sistema deve persistir a configuração
  And exibir confirmação de alteração

Cenário 2: Desativar comissão de técnico
  Given um técnico com comissao_ativa = true
  When o admin define comissao_ativa = false
  And salva
  Then novas OS desse técnico não gerarão comissão
  And comissões já calculadas anteriormente permanecem no histórico

Cenário 3: Percentual inválido
  Given o admin informa comissao_pct <= 0 ou > 100
  When tenta salvar
  Then o sistema deve bloquear e exibir: "Percentual deve estar entre 0,01% e 100%"
```

**Regras de negócio:**
- `comissao_pct` deve ser float com até 2 casas decimais
- Alteração do percentual não recalcula comissões já confirmadas

---

### US-07 — Cálculo automático de comissão ao confirmar pagamento

**Como** admin,
**quero** que a comissão do técnico seja calculada automaticamente ao confirmar um pagamento,
**para** eliminar cálculos manuais e garantir consistência.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Pagamento confirmado de técnico com comissão ativa
  Given uma OS de um técnico com comissao_ativa = true e comissao_pct = 15
  And o pagamento é confirmado (via webhook ou manualmente) com valor = R$ 200,00
  When o sistema processa a confirmação
  Then deve calcular comissao = 200 * 0,15 = R$ 30,00
  And registrar o valor em tabela de comissões vinculada à OS e ao técnico
  And a comissão deve ter status "a pagar"

Cenário 2: Pagamento confirmado de técnico sem comissão ativa
  Given uma OS de um técnico com comissao_ativa = false
  When o pagamento é confirmado
  Then nenhuma comissão deve ser calculada ou registrada

Cenário 3: Pagamento cancelado após comissão calculada
  Given uma OS com comissão calculada e status "a pagar"
  When o pagamento é cancelado (estorno)
  Then a comissão deve ser marcada como "cancelada"
  And não deve ser incluída em extratos futuros
```

**Regras de negócio:**
- Base de cálculo: valor efetivamente recebido (não `valor_cobrado`)
- Comissão calculada com arredondamento para 2 casas decimais (HALF_UP)
- Cada OS gera no máximo 1 registro de comissão

---

### US-08 — Extrato de comissões por técnico

**Como** admin,
**quero** ver o extrato de comissões de cada técnico filtrado por período,
**para** controlar o que deve ser pago a cada técnico.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Consulta de extrato com resultados
  Given o admin seleciona um técnico e um período (data início / data fim)
  When acessa o extrato de comissões
  Then deve exibir lista de OS pagas no período com: número da OS, data pagamento, valor recebido, percentual e valor da comissão
  And deve exibir total de comissões do período

Cenário 2: Consulta sem resultados
  Given o admin seleciona um período sem OS pagas para o técnico
  When acessa o extrato
  Then deve exibir mensagem: "Nenhuma comissão encontrada no período"

Cenário 3: Exportação do extrato
  Given o extrato exibe resultados
  When o admin clica em "Exportar"
  Then deve gerar arquivo PDF ou CSV com os dados listados
```

**Ambiguidade a resolver:**
- O admin pode marcar comissões como "pagas ao técnico"? Ou o controle de repasse é fora do sistema?

---

## User Stories — Melhorias Futuras

---

### US-09 — Painel financeiro: indicadores de receita

**Como** admin,
**quero** ver no painel financeiro a receita total, valor a receber e total em inadimplência,
**para** ter visão rápida da saúde financeira da empresa.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Exibição dos indicadores
  Given o admin acessa o painel financeiro
  When a tela carrega
  Then deve exibir três cards:
    - "Receita Total": soma de valor_cobrado das OS com status_pagamento = "pago"
    - "A Receber": soma de valor_cobrado das OS com status_pagamento = "pendente" e não inadimplentes
    - "Inadimplência": soma de valor_cobrado das OS inadimplentes
  And os valores devem refletir o mês corrente por padrão
  And deve haver seletor de período (mês/trimestre/ano/personalizado)
```

**Regras de negócio:**
- Inadimplente: OS com `status_pagamento = pendente` e data de conclusão há mais de 3 dias

---

### US-10 — Fluxo de caixa mensal (gráfico)

**Como** admin,
**quero** ver um gráfico de fluxo de caixa mensal,
**para** identificar tendências de receita ao longo do tempo.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Gráfico carregado
  Given o admin acessa o painel financeiro
  When seleciona o ano de referência
  Then deve exibir gráfico de barras ou linha com receita confirmada por mês (jan–dez)
  And cada barra deve exibir o valor total ao passar o mouse (tooltip)

Cenário 2: Mês sem dados
  Given um mês sem OS pagas
  When o gráfico renderiza
  Then o mês deve aparecer com valor zero (sem quebrar o gráfico)
```

---

### US-11 — Ranking de técnicos por receita gerada

**Como** admin,
**quero** ver um ranking dos técnicos por receita gerada no período,
**para** identificar os mais produtivos e tomar decisões de incentivo.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Ranking exibido
  Given o admin acessa o painel financeiro
  When seleciona o período
  Then deve exibir lista de técnicos ordenada por soma de valor_cobrado das OS pagas atribuídas a cada um
  And deve exibir: posição, nome do técnico, quantidade de OS pagas e valor total gerado

Cenário 2: Técnico sem OS no período
  Given um técnico sem OS concluídas e pagas no período selecionado
  When o ranking é gerado
  Then o técnico não deve aparecer no ranking (ou aparecer no final com valor zerado — definir com o cliente)
```

---

### US-12 — Lembrete automático de OS inadimplentes

**Como** admin,
**quero** receber lembrete automático das OS inadimplentes após 3 dias,
**para** acionar a cobrança sem precisar monitorar o sistema manualmente.

**Critérios de Aceitação (BDD):**

```
Cenário 1: Lembrete enviado ao atingir 3 dias de inadimplência
  Given uma OS com status_pagamento = "pendente"
  And data de conclusão há exatamente 3 dias
  When o job agendado (cron) executa
  Then o sistema deve enviar notificação ao admin (canal a definir: e-mail, WhatsApp ou notificação in-app)
  And a notificação deve conter: número da OS, cliente, valor e dias em aberto

Cenário 2: OS paga antes do lembrete ser enviado
  Given uma OS que atingiria 3 dias de inadimplência
  And o pagamento é confirmado antes do cron executar
  When o cron executa
  Then não deve enviar lembrete para essa OS

Cenário 3: Lembrete não duplicado
  Given uma OS inadimplente que já recebeu lembrete
  When o cron executa no dia seguinte
  Then não deve enviar novo lembrete (salvo configuração de lembretes recorrentes — a definir)
```

**Ambiguidade a resolver:**
- Lembrete vai para o admin, para o cliente ou para ambos?
- Canal do lembrete: e-mail, WhatsApp ou notificação dentro do sistema?
- Lembretes são enviados uma única vez ou repetidos (ex: a cada 3 dias)?

---

## Ambiguidades e Perguntas para o Cliente

| # | Pergunta | US relacionada |
|---|----------|---------------|
| 1 | Qual provedor de WhatsApp será utilizado? (Twilio, Z-API, Evolution API, outro?) | US-03 |
| 2 | A mensagem de WhatsApp terá template fixo ou o admin pode personalizá-la? | US-03 |
| 3 | O sistema deve controlar o repasse de comissão ao técnico (marcar como "pago")? | US-08 |
| 4 | No ranking de técnicos (US-11), técnico sem OS no período aparece no ranking com zero ou é omitido? | US-11 |
| 5 | O lembrete de inadimplência (US-12) vai para o admin, para o cliente ou para ambos? | US-12 |
| 6 | O lembrete é enviado uma única vez (aos 3 dias) ou se repete periodicamente enquanto inadimplente? | US-12 |
| 7 | Existe diferença de permissão entre administradores? (ex: apenas admin master pode alterar comissões) | US-06 |

---

## Resumo de Priorização

| User Story | Descrição | Prioridade |
|------------|-----------|-----------|
| US-01 | Geração automática de Pix ao concluir OS | MVP |
| US-02 | Confirmação de pagamento via webhook | MVP |
| US-03 | Envio de link Pix via WhatsApp | MVP |
| US-04 | Registro de pagamento manual com valor e observação | MVP |
| US-05 | Marcar OS como paga sem gerar Pix | MVP |
| US-06 | Configurar comissão por técnico (ativar/desativar + percentual) | MVP |
| US-07 | Cálculo automático de comissão ao confirmar pagamento | MVP |
| US-08 | Extrato de comissões por técnico no período | MVP |
| US-09 | Painel financeiro: receita total, a receber e inadimplência | Melhoria |
| US-10 | Gráfico de fluxo de caixa mensal | Melhoria |
| US-11 | Ranking de técnicos por receita | Melhoria |
| US-12 | Lembrete automático de OS inadimplentes | Melhoria |
