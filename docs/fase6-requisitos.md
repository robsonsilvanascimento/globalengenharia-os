# Fase 6 — Requisitos: Estoque de Peças, Custo de Peças na OS e Manutenção Preventiva

Sistema: Global Engenharia — Gestão de Ordens de Serviço
Data: 2026-07-13
Responsável: Analista de Requisitos

---

## Contexto e Premissas

- A OS já possui os campos `valor_cobrado` e `estimativa_custo` (composto por mão de obra, combustível e diárias).
- A Fase 6 introduz `custo_total_pecas`, calculado automaticamente como a soma das peças consumidas na OS.
- O custo total do serviço passa a ser: **mão de obra + combustível + diárias + custo de peças**.
- Componentes instalados já existem no sistema (rastreabilidade); agora receberão configuração de manutenção preventiva.
- Toda saída de peça por consumo em OS deve gerar uma `MovimentacaoEstoque` de saída atomicamente com o `ConsumoOSPeca`.

---

## Prioridades

| ID | User Story | Prioridade |
|----|-----------|------------|
| US-01 | Cadastro de peças | MVP |
| US-02 | Entrada de peças no estoque | MVP |
| US-03 | Registro de peças consumidas na OS | MVP |
| US-04 | Alerta de estoque mínimo | MVP |
| US-05 | Histórico de movimentações de peça | MVP |
| US-06 | Custo de peças somado automaticamente à OS | MVP |
| US-07 | Detalhamento de peças por OS | MVP |
| US-08 | Campo de custo de peças na estimativa | MVP |
| US-09 | Intervalo de manutenção preventiva em componente instalado | MVP |
| US-10 | Alerta 30 dias antes da manutenção vencer | MVP |
| US-11 | Registro de manutenção preventiva realizada | MVP |
| US-12 | Notificação WhatsApp ao cliente | Melhoria futura |

---

## Estoque de Peças

---

### US-01 — Cadastro de peças

**Como** admin,
**quero** cadastrar peças com código, nome, preço unitário, estoque atual e estoque mínimo,
**para** ter controle centralizado do inventário de materiais utilizados nas OS.

#### Critérios de Aceitação (BDD)

**Cenário 1: Cadastro com sucesso**
```
Given que estou autenticado como admin
And acesso o formulário de cadastro de peça
When preencho código, nome, preço unitário (> 0), estoque atual (>= 0) e estoque mínimo (>= 0)
And confirmo o cadastro
Then a peça é salva no sistema
And aparece na listagem de peças
```

**Cenário 2: Código duplicado**
```
Given que já existe uma peça com o código "PCA-001"
When tento cadastrar outra peça com o mesmo código
Then o sistema exibe erro "Código de peça já cadastrado"
And nenhuma peça é criada
```

**Cenário 3: Campos obrigatórios ausentes**
```
Given que estou no formulário de cadastro de peça
When submeto sem preencher nome ou preço unitário
Then o sistema exibe mensagem de validação por campo obrigatório
And nenhuma peça é criada
```

**Cenário 4: Preço inválido**
```
Given que estou no formulário de cadastro de peça
When preencho preço unitário com valor zero ou negativo
Then o sistema exibe erro "Preço unitário deve ser maior que zero"
```

#### Regras de Negócio
- Código da peça é único no sistema.
- Preço unitário deve ser maior que zero.
- Estoque atual e estoque mínimo devem ser maiores ou iguais a zero.
- Campos obrigatórios: código, nome, preço unitário, estoque mínimo.
- Estoque atual pode ser informado no cadastro ou iniciar em zero.

---

### US-02 — Entrada de peças no estoque

**Como** admin,
**quero** registrar entrada de peças no estoque (compra/recebimento) com preço e quantidade,
**para** manter o inventário atualizado após cada aquisição.

#### Critérios de Aceitação (BDD)

**Cenário 1: Entrada registrada com sucesso**
```
Given que estou autenticado como admin
And seleciono uma peça existente
When registro uma entrada com quantidade (> 0) e preço unitário (> 0)
And confirmo a operação
Then o estoque atual da peça é incrementado pela quantidade informada
And uma MovimentacaoEstoque do tipo "entrada" é registrada com data, quantidade e preço unitário
```

**Cenário 2: Quantidade inválida**
```
Given que estou no formulário de entrada de estoque
When informo quantidade zero ou negativa
Then o sistema exibe erro "Quantidade deve ser maior que zero"
And o estoque não é alterado
```

**Cenário 3: Peça não encontrada**
```
Given que informo um código de peça inexistente
When confirmo a entrada
Then o sistema exibe erro "Peça não encontrada"
```

#### Regras de Negócio
- Cada entrada gera um registro em `MovimentacaoEstoque` com tipo `entrada`, quantidade, preço unitário informado e data/hora.
- O preço unitário da entrada não altera o preço unitário cadastrado na peça (preço de venda/custo padrão); é registrado historicamente na movimentação.
- `estoqueAtual += quantidade` após a entrada.

---

### US-03 — Registro de peças consumidas na OS

**Como** técnico,
**quero** registrar as peças consumidas em uma OS,
**para** que o estoque seja descontado automaticamente e o custo da OS seja atualizado.

#### Critérios de Aceitação (BDD)

**Cenário 1: Consumo registrado com sucesso**
```
Given que estou autenticado como técnico
And a OS está no status que permite consumo de peças (aberta ou em andamento)
And a peça tem estoque suficiente
When registro o consumo de uma peça com a quantidade utilizada
Then um registro ConsumoOSPeca é criado com preço histórico = preço unitário atual da peça
And o subtotal do consumo = quantidade * preço histórico
And o estoque atual da peça é decrementado pela quantidade
And uma MovimentacaoEstoque do tipo "saida" é criada atomicamente
And o custo_total_pecas da OS é recalculado
```

**Cenário 2: Estoque insuficiente**
```
Given que a peça "PCA-001" tem estoque atual = 2
When o técnico tenta registrar consumo de 5 unidades
Then o sistema exibe erro "Estoque insuficiente. Disponível: 2"
And nenhum registro é criado e o estoque não é alterado
```

**Cenário 3: OS em status não permitido**
```
Given que a OS está com status "concluída" ou "cancelada"
When o técnico tenta registrar consumo de peça
Then o sistema exibe erro "Não é possível registrar consumo em OS com status [status]"
```

**Cenário 4: Remoção de consumo registrado**
```
Given que um ConsumoOSPeca foi registrado
When o admin remove o consumo
Then o estoque da peça é devolvido (incrementado pela quantidade removida)
And uma MovimentacaoEstoque de "estorno" é criada
And o custo_total_pecas da OS é recalculado
```

#### Regras de Negócio
- A criação de `ConsumoOSPeca` e `MovimentacaoEstoque (saida)` é atômica — ou ambas ocorrem ou nenhuma.
- O `precoUnitario` registrado no `ConsumoOSPeca` é o preço da peça **no momento do consumo** (preço histórico); alterações futuras no preço da peça não afetam consumos já registrados.
- `subtotal = quantidade * precoUnitario` (preço histórico).
- `custo_total_pecas` da OS = soma de todos os `subtotal` dos `ConsumoOSPeca` vinculados à OS.
- Status que permitem consumo: a definir com o usuário final (ver ambiguidades).

---

### US-04 — Alerta de estoque mínimo

**Como** admin,
**quero** receber alerta quando o estoque de uma peça ficar abaixo do mínimo,
**para** providenciar reposição antes de faltar material.

#### Critérios de Aceitação (BDD)

**Cenário 1: Alerta disparado após saída**
```
Given que a peça "PCA-001" tem estoqueAtual = 3 e estoqueMinimo = 3
When ocorre uma saída de qualquer quantidade
Then o sistema identifica que estoqueAtual <= estoqueMinimo
And gera um alerta visível na interface para o admin
And o alerta indica o nome da peça, estoque atual e estoque mínimo
```

**Cenário 2: Alerta não disparado quando estoque acima do mínimo**
```
Given que a peça tem estoqueAtual = 10 e estoqueMinimo = 5
When ocorre uma saída de 4 unidades (estoqueAtual passa a 6)
Then nenhum alerta de estoque mínimo é gerado para essa peça
```

**Cenário 3: Listagem de peças em alerta**
```
Given que existem peças com estoque abaixo do mínimo
When o admin acessa o painel de alertas de estoque
Then o sistema exibe a lista de todas as peças com estoqueAtual <= estoqueMinimo
```

#### Regras de Negócio
- Condição de alerta: `estoqueAtual <= estoqueMinimo` após qualquer operação de saída.
- O alerta é verificado a cada saída registrada (consumo em OS ou ajuste manual).
- Forma de notificação (e-mail, painel, push): a definir com o usuário final (ver ambiguidades).

---

### US-05 — Histórico de movimentações de peça

**Como** admin,
**quero** ver o histórico de movimentações de uma peça (entradas e saídas),
**para** auditar o uso e rastrear o consumo ao longo do tempo.

#### Critérios de Aceitação (BDD)

**Cenário 1: Histórico exibido corretamente**
```
Given que a peça "PCA-001" possui movimentações registradas
When o admin acessa o histórico da peça
Then o sistema exibe a lista de movimentações em ordem cronológica decrescente
And cada linha mostra: data/hora, tipo (entrada/saida/estorno), quantidade, preço unitário, saldo resultante e referência (número da OS ou nota de compra, se aplicável)
```

**Cenário 2: Peça sem movimentações**
```
Given que a peça foi cadastrada recentemente sem movimentações
When o admin acessa o histórico
Then o sistema exibe mensagem "Nenhuma movimentação registrada para esta peça"
```

**Cenário 3: Filtro por período**
```
Given que o admin está no histórico de uma peça
When filtra por intervalo de datas
Then o sistema exibe apenas as movimentações dentro do período selecionado
```

#### Regras de Negócio
- Toda entrada, saída e estorno gera um registro em `MovimentacaoEstoque`.
- O saldo resultante de cada linha é calculado: saldo da linha anterior +/- quantidade da movimentação.

---

## Custo de Peças na OS

---

### US-06 — Custo de peças somado automaticamente à OS

**Como** admin,
**quero** que o valor das peças consumidas seja somado automaticamente ao custo da OS,
**para** ter o custo total real do serviço sem cálculo manual.

#### Critérios de Aceitação (BDD)

**Cenário 1: Atualização automática após consumo**
```
Given que a OS tem custo_total_pecas = R$ 0,00
When o técnico registra o consumo de 2 unidades da peça "PCA-001" a R$ 50,00 cada
Then o custo_total_pecas da OS passa a R$ 100,00
And o custo total do serviço = estimativa_mao_de_obra + estimativa_combustivel + estimativa_diarias + custo_total_pecas
```

**Cenário 2: Múltiplos consumos acumulados**
```
Given que a OS já tem custo_total_pecas = R$ 100,00
When um novo consumo de R$ 75,00 é registrado
Then o custo_total_pecas passa a R$ 175,00
```

**Cenário 3: Remoção de consumo**
```
Given que a OS tem custo_total_pecas = R$ 175,00
When o admin remove um ConsumoOSPeca de subtotal R$ 75,00
Then o custo_total_pecas passa a R$ 100,00
```

#### Regras de Negócio
- `custo_total_pecas` é derivado e não editado manualmente — sempre calculado como soma dos `subtotal` dos `ConsumoOSPeca`.
- O custo total da OS para fins de relatório = `estimativa_mao_de_obra + estimativa_combustivel + estimativa_diarias + custo_total_pecas`.
- `custo_total_pecas` não substitui nem altera `estimativa_custo` já existente — são campos separados.

---

### US-07 — Detalhamento de peças usadas na OS

**Como** admin,
**quero** ver o detalhamento de peças usadas em cada OS com valor unitário e subtotal,
**para** apresentar ao cliente e para fins de auditoria.

#### Critérios de Aceitação (BDD)

**Cenário 1: Detalhamento exibido na OS**
```
Given que a OS possui ConsumoOSPeca registrados
When o admin acessa o detalhe da OS
Then o sistema exibe uma seção "Peças Consumidas" com tabela contendo:
  - Código da peça
  - Nome da peça
  - Quantidade
  - Preço unitário (histórico no momento do consumo)
  - Subtotal (quantidade * preço unitário)
And ao final da tabela exibe o total: custo_total_pecas
```

**Cenário 2: OS sem peças consumidas**
```
Given que a OS não possui ConsumoOSPeca
When o admin acessa o detalhe da OS
Then a seção "Peças Consumidas" exibe "Nenhuma peça consumida nesta OS"
And custo_total_pecas = R$ 0,00
```

#### Regras de Negócio
- O preço unitário exibido é sempre o histórico (registrado no momento do consumo), não o preço atual da peça.
- A seção de peças é exibida mesmo que vazia.

---

### US-08 — Campo de custo de peças na estimativa

**Como** admin,
**quero** que a estimativa de custo inclua um campo de custo de peças, separado da mão de obra,
**para** estimar o total do serviço antes de iniciá-lo.

#### Critérios de Aceitação (BDD)

**Cenário 1: Preenchimento da estimativa com custo de peças**
```
Given que estou criando ou editando uma OS
When preencho o campo "Estimativa de custo de peças"
Then o valor é salvo separadamente de mão de obra, combustível e diárias
And o total estimado = soma de todos os campos de estimativa
```

**Cenário 2: Campo opcional**
```
Given que estou criando uma OS sem previsão de uso de peças
When deixo o campo "Estimativa de custo de peças" em branco ou zero
Then a OS é salva normalmente
And o total estimado considera esse campo como R$ 0,00
```

**Cenário 3: Comparativo estimativa x realizado**
```
Given que a OS foi concluída com peças consumidas
When o admin visualiza o resumo financeiro da OS
Then o sistema exibe: estimativa de peças vs custo_total_pecas real lado a lado
```

#### Regras de Negócio
- O campo de estimativa de custo de peças é opcional e editável enquanto a OS não estiver concluída.
- `custo_total_pecas` (realizado) e estimativa de peças são campos independentes — um não substitui o outro.

---

## Manutenção Preventiva

---

### US-09 — Intervalo de manutenção preventiva em componente instalado

**Como** admin,
**quero** associar um intervalo de manutenção preventiva a um componente instalado (ex: 365 dias),
**para** planejar revisões periódicas e garantir o bom funcionamento dos equipamentos.

#### Critérios de Aceitação (BDD)

**Cenário 1: Configuração de intervalo com sucesso**
```
Given que estou autenticado como admin
And acesso um componente instalado existente
When defino o intervalo de manutenção preventiva em dias (ex: 365)
And confirmo
Then o campo intervaloDias é salvo no componente instalado
And proximaEm = criadoEm + intervaloDias (se nunca houve manutenção) ou ultimaRealizadaEm + intervaloDias
```

**Cenário 2: Intervalo inválido**
```
Given que estou configurando a manutenção preventiva
When informo intervalo zero ou negativo
Then o sistema exibe erro "O intervalo deve ser maior que zero dias"
```

**Cenário 3: Atualização de intervalo**
```
Given que o componente já tem um intervalo configurado
When o admin altera o intervalo para um novo valor
Then o proximaEm é recalculado com base no novo intervalo a partir de ultimaRealizadaEm (ou criadoEm)
```

#### Regras de Negócio
- `proximaEm = ultimaRealizadaEm + intervaloDias` quando já houve ao menos uma manutenção registrada.
- `proximaEm = criadoEm + intervaloDias` quando o componente nunca teve manutenção registrada.
- `intervaloDias` deve ser maior que zero.
- A data `proximaEm` é recalculada automaticamente sempre que `ultimaRealizadaEm` ou `intervaloDias` mudar.

---

### US-10 — Alerta 30 dias antes da manutenção preventiva vencer

**Como** admin,
**quero** receber alerta 30 dias antes da manutenção preventiva vencer,
**para** agendar o serviço com antecedência e evitar vencimento sem atendimento.

#### Critérios de Aceitação (BDD)

**Cenário 1: Alerta gerado corretamente**
```
Given que um componente instalado tem proximaEm = 2026-08-12
And a data atual é 2026-07-13 (30 dias antes)
When o sistema executa a verificação de alertas preventivos
Then um alerta é gerado para o admin com: nome do componente, cliente, data de vencimento e dias restantes
```

**Cenário 2: Alerta não repetido no mesmo dia**
```
Given que o alerta para o componente X já foi gerado hoje
When o sistema executa novamente a verificação no mesmo dia
Then nenhum alerta duplicado é gerado
```

**Cenário 3: Componente vencido (sem alerta prévio)**
```
Given que um componente tem proximaEm no passado
When o sistema executa a verificação
Then um alerta de "manutenção vencida" é gerado, distinto do alerta de proximidade
```

**Cenário 4: Componente sem intervalo configurado**
```
Given que um componente instalado não tem intervaloDias definido
When o sistema executa a verificação
Then nenhum alerta é gerado para esse componente
```

#### Regras de Negócio
- A janela de alerta antecipado é fixa em 30 dias antes de `proximaEm`.
- O sistema deve evitar alertas duplicados para o mesmo componente no mesmo dia.
- Componentes com `proximaEm` no passado devem ter alerta de "vencido", separado do alerta preventivo.
- Mecanismo de disparo (job agendado, webhook, cron): definição cabe ao Arquiteto.

---

### US-11 — Registro de manutenção preventiva realizada

**Como** admin,
**quero** registrar que uma manutenção preventiva foi realizada,
**para** reiniciar o contador e manter o histórico de intervenções.

#### Critérios de Aceitação (BDD)

**Cenário 1: Registro com sucesso**
```
Given que estou autenticado como admin
And seleciono um componente instalado com manutenção preventiva configurada
When registro a realização da manutenção com a data de execução
Then o campo ultimaRealizadaEm é atualizado com a data informada
And proximaEm é recalculado: ultimaRealizadaEm + intervaloDias
And um registro histórico da manutenção realizada é criado
And o alerta anterior (se existir) é marcado como resolvido
```

**Cenário 2: Data futura inválida**
```
Given que estou registrando a manutenção
When informo uma data de execução no futuro
Then o sistema exibe erro "A data de realização não pode ser futura"
```

**Cenário 3: Histórico de manutenções**
```
Given que um componente teve múltiplas manutenções registradas
When o admin acessa o histórico de manutenções do componente
Then o sistema lista todas as datas de realização em ordem cronológica decrescente
```

#### Regras de Negócio
- A data de realização não pode ser futura.
- Cada registro de manutenção cria um histórico imutável.
- Ao registrar a manutenção, `ultimaRealizadaEm` é atualizado e `proximaEm` recalculado automaticamente.
- O registro pode ou não estar vinculado a uma OS (vínculo opcional — ver ambiguidades).

---

### US-12 — Notificação WhatsApp ao cliente (Melhoria futura)

**Como** cliente,
**quero** receber notificação via WhatsApp quando minha manutenção preventiva estiver próxima,
**para** ser avisado com antecedência e poder agendar o serviço.

#### Critérios de Aceitação (BDD)

**Cenário 1: Notificação enviada**
```
Given que um componente instalado do cliente tem proximaEm em 30 dias ou menos
And o cliente possui número de WhatsApp cadastrado
When o sistema dispara as notificações preventivas
Then uma mensagem WhatsApp é enviada ao cliente com: nome do componente, data prevista de manutenção e instruções de contato
```

**Cenário 2: Cliente sem WhatsApp cadastrado**
```
Given que o cliente não possui número de WhatsApp cadastrado
When o sistema tenta enviar a notificação
Then nenhuma mensagem é enviada
And o alerta interno para o admin é gerado normalmente
```

**Cenário 3: Notificação não duplicada**
```
Given que a notificação WhatsApp já foi enviada ao cliente para esse componente nesse ciclo
When o sistema verifica novamente
Then nenhuma nova mensagem é enviada para o mesmo vencimento
```

#### Regras de Negócio
- Notificação WhatsApp é complementar ao alerta interno — não o substitui.
- Integração depende de provedor externo (ex: Twilio, Z-API, Evolution API) — definição cabe ao Arquiteto.
- Prioridade: melhoria futura, não entra no MVP.

---

## Ambiguidades e Perguntas para o Usuário Final

As questões abaixo não podem ser respondidas pelo time técnico — precisam de decisão do cliente antes da implementação.

| # | Pergunta | Impacto |
|---|---------|---------|
| A1 | Quais status da OS permitem registro de consumo de peças? Apenas "em andamento" ou também "aberta"? | US-03 — validação de status |
| A2 | O técnico pode remover um consumo de peça já registrado, ou apenas o admin? | US-03 / US-06 — permissões |
| A3 | O alerta de estoque mínimo é apenas visual no painel ou também envia e-mail/notificação push? | US-04 — canal de alerta |
| A4 | O registro de manutenção preventiva realizada deve obrigatoriamente estar vinculado a uma OS ou pode ser avulso? | US-11 — integridade de rastreamento |
| A5 | Quando o admin registra entrada de peças, o preço da entrada atualiza o preço unitário padrão da peça ou apenas fica no histórico? | US-02 — política de custo (FIFO/preço médio/fixo) |
| A6 | Existe perfil de estoquista separado de admin, ou o controle de estoque é exclusivo do admin? | US-01 a US-05 — permissões |
| A7 | O cliente deve visualizar o custo de peças no relatório/recibo da OS, ou essa informação é interna? | US-07 — visibilidade financeira |
| A8 | A notificação WhatsApp para manutenção preventiva deve ser automática ou acionada manualmente pelo admin? | US-12 — modo de disparo |

---

## Glossário

| Termo | Definição |
|-------|-----------|
| `ConsumoOSPeca` | Registro que associa uma peça a uma OS com quantidade e preço histórico |
| `MovimentacaoEstoque` | Log de toda entrada, saída ou estorno de peça no inventário |
| `custo_total_pecas` | Soma calculada dos subtotais de todos os ConsumoOSPeca de uma OS |
| `subtotal` | `quantidade * precoUnitario` no momento do consumo |
| `proximaEm` | Data calculada da próxima manutenção preventiva do componente instalado |
| `ultimaRealizadaEm` | Data da última manutenção preventiva efetivamente realizada |
| `intervaloDias` | Periodicidade em dias da manutenção preventiva configurada no componente |
