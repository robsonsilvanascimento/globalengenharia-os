# Fase 4 — Portal do Cliente e NPS
**Sistema:** Gestão de Ordens de Serviço — Global Engenharia
**Data:** 2026-07-13
**Status:** Requisitos aprovados para implementação

---

## Contexto do Sistema Existente

- **Painel Admin:** React (web)
- **App Técnico:** Expo (mobile)
- **Backend:** Fastify + Prisma + PostgreSQL
- **Canal de comunicação com clientes:** WhatsApp (principal) e e-mail
- Clientes já estão cadastrados no banco de dados; não possuem conta/senha no sistema

---

## Regras de Negócio Globais da Fase 4

| Regra | Detalhe |
|---|---|
| RN-01 | Token do portal do cliente expira em 30 dias após a geração |
| RN-02 | Token do portal é de uso múltiplo — o cliente pode acessar quantas vezes quiser dentro da validade |
| RN-03 | O link NPS expira em 7 dias após o envio |
| RN-04 | NPS só pode ser respondido uma única vez por OS |
| RN-05 | O envio do NPS ocorre somente quando `status = 'concluida'` E `npsEnviadoEm IS NULL` |
| RN-06 | Score NPS = % promotores (notas 9–10) − % detratores (notas 0–6). Notas 7–8 são neutras |
| RN-07 | O portal exibe apenas as OS vinculadas ao CPF/CNPJ do cliente dono do token |
| RN-08 | Fotos de evidência e PDF do relatório são acessíveis apenas via token válido |

---

## User Stories

---

### US-01 — Acesso ao portal via link sem senha

**Como** cliente,
**quero** receber um link por WhatsApp ou e-mail após minha OS ser concluída,
**para** acompanhar o status da minha OS sem precisar criar conta ou digitar senha.

#### Critérios de Aceite (BDD)

**Cenário 1 — Geração e envio do link ao concluir a OS**

```
Given que uma OS tem seu status alterado para 'concluida' pelo técnico ou admin
When o sistema processa a mudança de status
Then um token único é gerado e associado ao cliente dono da OS
And o token tem validade de 30 dias a partir da geração
And o sistema envia o link "<base_url>/portal?token=<token>" via WhatsApp para o número cadastrado do cliente
And, se o cliente possuir e-mail cadastrado, o mesmo link é enviado também por e-mail
And o campo `portalTokenEnviadoEm` é preenchido com a data/hora do envio
```

**Cenário 2 — Acesso com token válido**

```
Given que o cliente possui um link com token válido (dentro de 30 dias)
When o cliente acessa o link no navegador
Then o sistema autentica o cliente silenciosamente pelo token
And exibe o portal com o histórico de OS daquele cliente
And não solicita login, senha ou cadastro
```

**Cenário 3 — Acesso com token expirado**

```
Given que o cliente acessa o link com token com mais de 30 dias de emissão
When o sistema valida o token
Then exibe mensagem informando que o link expirou
And exibe instrução para entrar em contato pelo WhatsApp da empresa para obter novo acesso
And nenhuma informação de OS é exibida
```

**Cenário 4 — Acesso com token inválido ou adulterado**

```
Given que o cliente acessa um link com token inexistente no banco
When o sistema valida o token
Then retorna erro 401
And exibe mensagem genérica de "link inválido"
```

#### Regras de Negócio Aplicáveis
- RN-01, RN-02, RN-07

---

### US-02 — Histórico de OS do cliente

**Como** cliente,
**quero** ver o histórico de todas as minhas OS (número, status, data, valor),
**para** ter uma visão geral dos serviços realizados pela Global Engenharia.

#### Critérios de Aceite (BDD)

**Cenário 1 — Listagem de OS**

```
Given que o cliente está autenticado no portal via token válido
When acessa a página inicial do portal
Then visualiza a lista de todas as suas OS ordenadas da mais recente para a mais antiga
And cada item da lista exibe: número da OS, status atual, data de abertura, data de conclusão (se houver) e valor total
And OS com status 'concluida' são exibidas com destaque visual diferenciado
```

**Cenário 2 — Cliente sem OS**

```
Given que o cliente está autenticado no portal via token válido
And não possui nenhuma OS registrada em seu CPF/CNPJ
When acessa a página inicial do portal
Then visualiza mensagem informando que não há ordens de serviço registradas
```

**Cenário 3 — Isolamento de dados**

```
Given que o cliente está autenticado no portal via token válido
When acessa a lista de OS
Then visualiza somente as OS vinculadas ao seu próprio CPF/CNPJ
And não é possível acessar OS de outros clientes mesmo alterando parâmetros na URL
```

#### Regras de Negócio Aplicáveis
- RN-01, RN-02, RN-07

---

### US-03 — Detalhes de uma OS específica

**Como** cliente,
**quero** ver os detalhes de uma OS específica (descrição, técnico responsável, fotos de evidência),
**para** entender o que foi executado no serviço.

#### Critérios de Aceite (BDD)

**Cenário 1 — Visualização dos detalhes**

```
Given que o cliente está autenticado via token válido
And seleciona uma OS da sua lista
When acessa a página de detalhes da OS
Then visualiza: número da OS, descrição do serviço, nome do técnico responsável, data de execução, status, valor e observações do técnico
And, se houver fotos de evidência anexadas, visualiza uma galeria de imagens
And, se não houver fotos, exibe mensagem "Nenhuma foto registrada para esta OS"
```

**Cenário 2 — Tentativa de acesso a OS de outro cliente**

```
Given que o cliente está autenticado via token válido
When tenta acessar diretamente a URL de detalhes de uma OS que não pertence ao seu CPF/CNPJ
Then o sistema retorna erro 403
And nenhum dado da OS alheia é exibido
```

**Cenário 3 — Acesso a fotos**

```
Given que o cliente visualiza os detalhes de uma OS com fotos
When clica em uma foto da galeria
Then a imagem é exibida em tamanho ampliado
And as URLs das imagens são protegidas e só acessíveis via token válido
```

#### Regras de Negócio Aplicáveis
- RN-01, RN-02, RN-07, RN-08

---

### US-04 — Download do PDF do relatório técnico

**Como** cliente,
**quero** baixar o PDF do relatório técnico da minha OS,
**para** ter a documentação formal do serviço executado para meus registros.

#### Critérios de Aceite (BDD)

**Cenário 1 — Download com relatório disponível**

```
Given que o cliente está autenticado via token válido
And acessa os detalhes de uma OS com status 'concluida' que possui relatório gerado
When clica no botão "Baixar Relatório PDF"
Then o sistema gera ou recupera o PDF do relatório técnico
And inicia o download do arquivo com nome no formato "OS-<numero>-relatorio.pdf"
And o PDF contém: dados da empresa, dados do cliente, número da OS, descrição, técnico, data, valor e assinatura digital se disponível
```

**Cenário 2 — OS sem relatório gerado**

```
Given que o cliente acessa os detalhes de uma OS
And o relatório PDF ainda não foi gerado para aquela OS
When visualiza a página de detalhes
Then o botão "Baixar Relatório PDF" é exibido como desabilitado
And exibe tooltip ou mensagem "Relatório ainda não disponível"
```

**Cenário 3 — Tentativa de download sem token válido**

```
Given que alguém tenta acessar diretamente a URL de download do PDF sem token válido
When o sistema valida a requisição
Then retorna erro 401
And o arquivo não é servido
```

#### Regras de Negócio Aplicáveis
- RN-01, RN-02, RN-07, RN-08

---

### US-05 — Pesquisa de satisfação NPS após conclusão da OS

**Como** cliente,
**quero** receber uma pesquisa de satisfação (notas de 0 a 10) após minha OS ser concluída,
**para** avaliar o serviço prestado pela Global Engenharia.

#### Critérios de Aceite (BDD)

**Cenário 1 — Envio automático do link NPS**

```
Given que uma OS tem seu status alterado para 'concluida'
And o campo `npsEnviadoEm` da OS está NULL
When o sistema processa a mudança de status (ou um job agendado roda após 24h)
Then aguarda 24 horas após a conclusão
And gera um token NPS único e de uso único associado à OS
And envia o link "<base_url>/nps?token=<token_nps>" via WhatsApp para o cliente
And registra a data/hora do envio no campo `npsEnviadoEm` da OS
And o token NPS tem validade de 7 dias
```

**Cenário 2 — OS já com NPS enviado não recebe novo envio**

```
Given que uma OS possui `npsEnviadoEm` preenchido
When qualquer processo tenta enviar NPS para aquela OS
Then o sistema não envia novo link
And não gera novo token NPS para aquela OS
```

**Cenário 3 — Exibição da pesquisa ao cliente**

```
Given que o cliente acessa o link NPS com token válido (dentro de 7 dias) e ainda não respondido
When a página NPS carrega
Then exibe a pergunta "Em uma escala de 0 a 10, o quanto você recomendaria a Global Engenharia a um amigo ou familiar?"
And exibe os botões de 0 a 10 de forma clara e selecionável
And exibe campo opcional de comentário
And exibe botão "Enviar avaliação"
```

**Cenário 4 — Token NPS expirado**

```
Given que o cliente acessa o link NPS com token com mais de 7 dias de emissão
When o sistema valida o token NPS
Then exibe mensagem informando que a pesquisa expirou
And não permite o envio de nota
```

#### Regras de Negócio Aplicáveis
- RN-03, RN-04, RN-05

---

### US-06 — Comentário opcional na resposta NPS

**Como** cliente,
**quero** adicionar um comentário opcional à minha nota NPS,
**para** detalhar minha experiência com o serviço além da nota numérica.

#### Critérios de Aceite (BDD)

**Cenário 1 — Envio de nota com comentário**

```
Given que o cliente está na página NPS com token válido
When seleciona uma nota de 0 a 10
And preenche o campo de comentário com texto livre
And clica em "Enviar avaliação"
Then o sistema salva a nota e o comentário associados à OS e ao cliente
And exibe mensagem de agradecimento confirmando o recebimento da avaliação
And invalida o token NPS para impedir nova resposta
And registra `npsRespondidoEm` com a data/hora atual
```

**Cenário 2 — Envio de nota sem comentário**

```
Given que o cliente está na página NPS com token válido
When seleciona uma nota de 0 a 10
And não preenche o campo de comentário
And clica em "Enviar avaliação"
Then o sistema salva a nota sem comentário
And exibe mensagem de agradecimento
And invalida o token NPS
```

**Cenário 3 — Tentativa de resposta duplicada**

```
Given que o cliente já respondeu a pesquisa NPS de uma OS
When tenta acessar novamente o link NPS da mesma OS
Then o sistema detecta que o token foi utilizado ou que `npsRespondidoEm` está preenchido
And exibe mensagem informando que a avaliação já foi registrada
And não permite novo envio
```

**Cenário 4 — Envio sem selecionar nota**

```
Given que o cliente está na página NPS
When clica em "Enviar avaliação" sem selecionar nenhuma nota
Then o sistema exibe mensagem de validação solicitando que uma nota seja selecionada
And não submete o formulário
```

#### Regras de Negócio Aplicáveis
- RN-03, RN-04, RN-06

---

### US-07 — Score NPS médio e distribuição de notas no painel admin

**Como** administrador,
**quero** ver o score NPS médio e a distribuição de notas por período no painel admin,
**para** acompanhar a satisfação dos clientes e identificar tendências.

#### Critérios de Aceite (BDD)

**Cenário 1 — Exibição do score NPS geral**

```
Given que o admin está autenticado no painel admin
When acessa a seção de NPS/Relatórios
Then visualiza o score NPS atual calculado como: (% promotores - % detratores) × 100
And o score é exibido em formato numérico de -100 a 100
And é exibida a classificação textual: "Crítico" (-100 a 0), "Aperfeiçoamento" (1 a 50), "Qualidade" (51 a 75) ou "Excelência" (76 a 100)
```

**Cenário 2 — Filtro por período**

```
Given que o admin está na seção de NPS
When seleciona um período (data início e data fim)
And clica em "Filtrar"
Then o score NPS é recalculado considerando apenas as respostas com `npsRespondidoEm` dentro do período
And a distribuição de notas é atualizada para o mesmo período
```

**Cenário 3 — Distribuição de notas**

```
Given que o admin está na seção de NPS com ou sem filtro de período aplicado
When visualiza a distribuição de notas
Then vê um gráfico ou tabela com a quantidade e percentual de respostas por nota (0 a 10)
And as notas são agrupadas visualmente em: Detratores (0–6), Neutros (7–8), Promotores (9–10)
And é exibido o total de respostas consideradas no cálculo
```

**Cenário 4 — Sem respostas no período**

```
Given que o admin filtra um período sem nenhuma resposta NPS registrada
When o sistema calcula o score
Then exibe mensagem "Nenhuma avaliação registrada no período selecionado"
And não exibe score nem distribuição
```

#### Regras de Negócio Aplicáveis
- RN-06

---

### US-08 — Visualização de comentários NPS no painel admin

**Como** administrador,
**quero** ver os comentários dos clientes nas respostas NPS,
**para** entender os motivos das notas e identificar pontos de melhoria ou elogio.

#### Critérios de Aceite (BDD)

**Cenário 1 — Lista de respostas com comentários**

```
Given que o admin está na seção de NPS
When acessa a aba ou seção "Comentários" ou "Respostas"
Then visualiza a lista de respostas que possuem comentário preenchido
And cada item exibe: nome do cliente, número da OS, nota, comentário e data da resposta
And a lista é ordenada da resposta mais recente para a mais antiga
```

**Cenário 2 — Filtro por nota/grupo**

```
Given que o admin está visualizando a lista de comentários
When filtra por grupo (Detratores / Neutros / Promotores)
Then a lista exibe apenas os comentários do grupo selecionado
```

**Cenário 3 — Filtro por período**

```
Given que o admin está visualizando a lista de comentários
When aplica filtro de período (data início / data fim)
Then a lista exibe apenas as respostas com `npsRespondidoEm` dentro do período selecionado
```

**Cenário 4 — Respostas sem comentário**

```
Given que o admin está na lista de comentários
When uma resposta NPS não possui comentário
Then essa resposta não aparece na listagem de comentários
And é contabilizada normalmente no score NPS
```

#### Regras de Negócio Aplicáveis
- RN-06

---

## Perguntas em Aberto / Ambiguidades

As questões abaixo precisam ser respondidas pelo usuário final antes da implementação:

| ID | Pergunta | Impacto |
|---|---|---|
| Q-01 | O link do portal enviado ao cliente (US-01) deve ser enviado apenas na primeira OS concluída ou em toda OS concluída? | Define se o token é gerado uma vez por cliente ou uma vez por OS |
| Q-02 | Se o cliente não tiver WhatsApp cadastrado nem e-mail, o que deve ocorrer? | Define tratamento de erro no envio |
| Q-03 | O PDF do relatório (US-04) já é gerado atualmente no sistema ou precisa ser criado do zero na Fase 4? | Define escopo do backend nesta US |
| Q-04 | O job de envio do NPS após 24h (US-05) deve usar um worker/cron interno ao backend ou integração com serviço de agendamento externo? | Impacto na arquitetura — decisão do Arquiteto, mas necessita confirmação de preferência do cliente |
| Q-05 | O painel de NPS (US-07 e US-08) deve ser acessível a todos os perfis de admin ou apenas ao perfil "gestor"? | Define controle de permissão |
| Q-06 | Deve haver possibilidade de reenvio manual do link NPS pelo admin (em caso de cliente que não recebeu)? | Define nova funcionalidade não mapeada nas US atuais |

---

## Priorização

| US | Título | Prioridade |
|---|---|---|
| US-01 | Acesso ao portal via link sem senha | MVP |
| US-02 | Histórico de OS do cliente | MVP |
| US-03 | Detalhes de uma OS específica | MVP |
| US-05 | Pesquisa NPS após conclusão da OS | MVP |
| US-06 | Comentário opcional na resposta NPS | MVP |
| US-07 | Score NPS médio e distribuição no admin | MVP |
| US-04 | Download do PDF do relatório técnico | Melhoria futura |
| US-08 | Visualização de comentários NPS no admin | Melhoria futura |
