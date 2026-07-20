# Plano de Auditoria — Conformidade com Contratos Externos

## Por que este documento existe

Em 2026-07-20, ao reconstruir o módulo `pagamento` em Arquitetura Hexagonal, encontrei
um bug crítico pré-existente: a validação de assinatura do webhook do Mercado Pago fazia
`xSignature.split('&')`, mas o Mercado Pago documenta o header `x-signature` separado por
**vírgula** (`ts=...,v1=...`). Resultado: `parts['v1']` ficava sempre `undefined` e a
validação **rejeitava todo webhook real** — a confirmação automática de Pix por webhook
provavelmente nunca funcionou em produção.

Esse trecho já tinha passado por revisão de segurança nesta mesma sessão (item "Review
pagamento module") e nenhum achado foi reportado. A revisão de segurança confirma que o
código *usa* HMAC + `timingSafeEqual` corretamente — mas nunca verificou se o **formato do
header calculado bate com o que o provedor realmente envia**. Isso não é uma categoria que
"segurança" (vulnerabilidades) ou "arquitetura" (concorrência/resiliência) cobrem por
padrão — é uma terceira lente: **o código está correto em relação à documentação real do
sistema externo, não só internamente consistente?**

Este documento é o plano para varrer o resto do backend atrás da mesma classe de erro.

## A lente de revisão (o que procurar)

Para cada ponto de integração externa, a pergunta não é "esse código parece bem escrito?"
mas sim: **"se eu pegar a documentação oficial e atual do provedor agora, este código
calcula/parseia exatamente o que está documentado, campo por campo, separador por
separador?"** Isso inclui:

- Nome e formato de headers de assinatura/autenticação (recebidos e enviados)
- Separadores, encoding (hex vs base64), ordem dos campos num manifest HMAC
- Nomes de campos em payloads de webhook (o JSON que chega de fora)
- Nomes de campos em respostas de SDK (o que a lib de terceiro devolve)
- Códigos de status/enums do provedor (ex.: `'approved'` vs `'aprovado'`) mapeados
  corretamente para o vocabulário interno
- Nomes de query params, escopos, formatos de data/hora esperados por endpoints externos

## Método (por item da lista)

1. Ler o código real do ponto de integração.
2. Buscar a documentação **atual** do provedor (via WebFetch — não confiar só no
   conhecimento de treinamento, que pode estar desatualizado ou a API pode ter mudado).
3. Comparar campo a campo / formato a formato com o código.
4. Se já existe teste cobrindo esse ponto: verificar se o teste usa um formato **inventado**
   (que só valida consistência interna, como aconteceu antes) ou um formato **verificado
   contra a doc real**. Corrigir o teste se for inventado.
5. Se não existe teste: escrever um com um fixture realista, baseado na doc.
6. Se achar divergência: corrigir, deixar o teste provando o formato real, e comentar no
   código a referência da doc (ex.: "formato documentado em ...").
7. Rodar `security-code-tester` + `infra-code-analyst` sobre a correção, como já é hábito
   neste projeto.

## Mapa de superfícies (por risco)

### P0 — dinheiro e autenticação de webhook (maior dano se errado)

- [x] **Mercado Pago — assinatura do webhook** (`pagamento/infrastructure/mercadopago/MercadoPagoGatewayAdapter.ts`)
      — corrigido em 2026-07-20 (separador `,` em vez de `&`), coberto por teste com
      formato real.
- [ ] **Mercado Pago — payload do webhook** (`extrairEventoWebhook`) — confirmar que
      `type`/`data.id` são exatamente os campos que o Mercado Pago envia hoje (a doc pode
      ter mudado desde que o código original foi escrito).
- [ ] **Mercado Pago — campos da resposta do SDK** (`MercadoPagoService.ts`):
      `point_of_interaction.transaction_data.qr_code_base64`/`qr_code`,
      `transaction_amount`, `external_reference`, `status`, `id`. Os tipos do pacote
      `mercadopago` (TS) ajudam mas não garantem — o SDK pode ter tipos otimistas/`any`
      em partes aninhadas.
- [ ] **Meta WhatsApp — assinatura do webhook** (`whatsapp/infrastructure/http/webhook-routes.ts`,
      função `assinaturaWebhookValida`) — já inspecionado nesta rodada de mapeamento:
      formato `sha256=<hex>` bate com a doc da Meta (`X-Hub-Signature-256`). Falta só
      confirmar contra a doc atual (pode ter sido alterado) e checar se o teste existente
      usa esse formato real (aparenta que sim, a confirmar formalmente).
- [ ] **Meta WhatsApp — handshake de verificação** (`hub.mode`/`hub.verify_token`/`hub.challenge`)
      — confirmar nomes exatos dos query params contra a doc atual.
- [ ] **Meta WhatsApp — payload de mensagem recebida** (`extrairMensagens`/`extrairConteudo`)
      — a estrutura `entry[].changes[].value.messages[]` e os campos por tipo de mensagem
      (`text.body`, `audio.id`, `video.id`) batem com o formato atual da Cloud API?

### P1 — funcionalidade crítica, não financeira

- [ ] **Meta WhatsApp — envio (outbound)**: `whatsapp/infrastructure/MetaCloudApiClient.ts`
      — `enviarTemplate`, `enviarDocumento`, `baixarMedia`. Confirmar endpoints, formato do
      corpo da requisição (estrutura de `components`/`parameters` de um template) e campos
      da resposta usados para extrair `messageId`/erros.
- [ ] **Google Calendar** (`google-calendar/infrastructure/GoogleCalendarService.ts`) —
      formato de criação/atualização de evento, fuso horário, campos de resposta usados
      para extrair o `eventId` salvo em `googleCalendarEventId`.

### P2 — qualidade/UX (menor dano se errado, mas ainda vale conferir)

- [ ] **Expo Push** (`notificacoes/infrastructure/queues/expo-push-worker.ts`,
      `expo-push-queue.ts`) — formato de token esperado, estrutura do payload de envio,
      como erros por token individual são identificados na resposta em lote.
- [ ] **E-mail/SMTP** (`shared/infra/email/EmailService.ts`, nodemailer) — menor risco de
      "formato de contrato" por ser um protocolo maduro/estável, mas confirmar campos de
      config (`secure`, porta, auth) contra o provedor SMTP usado em produção.
- [ ] **Transcrição/geração de áudio** (`shared/infra/audio/TranscreverAudioService.ts`,
      `GerarAudioService.ts`) — confirmar o provedor usado (OpenAI Whisper? outro) e se os
      campos de request/response batem com a API atual.
- [ ] **FAQ com IA** (`faq/application/BuscarRespostaFaqUseCase.ts`) — confirmar formato de
      chamada ao modelo (Anthropic/OpenAI) e tratamento de erro/limite de taxa.

## Ordem de execução sugerida (ondas)

1. **Onda A** (fecha o P0 que falta): payload do webhook MP, campos da resposta do SDK MP,
   confirmação formal da assinatura/handshake do WhatsApp e do payload de mensagem.
2. **Onda B**: MetaCloudApiClient (envio) + Google Calendar.
3. **Onda C**: Expo Push, Email, áudio, FAQ/IA.

Cada onda termina com: testes passando, `security-code-tester` + `infra-code-analyst`
rodados sobre qualquer correção, commit e push — mesmo padrão usado no resto do projeto.

## Salvaguarda para o futuro

Daqui em diante, sempre que eu escrever ou revisar código que fala com um sistema externo
(webhook, SDK de terceiro, header de autenticação), a verificação de conformidade com a
doc oficial atual (via WebFetch, não só memória) passa a ser parte do trabalho — não uma
auditoria à parte feita depois. Este documento registra a dívida acumulada até aqui; novas
integrações devem nascer já verificadas.
