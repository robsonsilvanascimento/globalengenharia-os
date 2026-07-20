-- Inbox pattern: registro bruto de webhooks de pagamento, gravado antes do
-- processamento de negocio. Auditoria/replay; a idempotencia de negocio
-- continua garantida pelo estado do PagamentoOS.

DO $$ BEGIN
  CREATE TYPE "StatusWebhookEventoPagamento" AS ENUM ('pendente','processado','falhou','ignorado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "webhook_eventos_pagamento" (
  "id" TEXT NOT NULL,
  "provedor" TEXT NOT NULL,
  "tipo_evento" TEXT NOT NULL,
  "id_externo" TEXT NOT NULL,
  "payload_bruto" TEXT NOT NULL,
  "status" "StatusWebhookEventoPagamento" NOT NULL DEFAULT 'pendente',
  "erro" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processado_em" TIMESTAMP(3),
  CONSTRAINT "webhook_eventos_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_eventos_pagamento_provedor_id_externo_idx" ON "webhook_eventos_pagamento"("provedor", "id_externo");
CREATE INDEX IF NOT EXISTS "webhook_eventos_pagamento_status_idx" ON "webhook_eventos_pagamento"("status");
