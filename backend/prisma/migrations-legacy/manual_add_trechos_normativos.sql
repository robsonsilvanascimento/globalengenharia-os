CREATE TABLE IF NOT EXISTS "trechos_normativos" (
  "id" TEXT NOT NULL,
  "norma" TEXT NOT NULL,
  "item" TEXT,
  "categoria" TEXT NOT NULL,
  "assunto" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "item_verificar" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trechos_normativos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "trechos_normativos_categoria_idx" ON "trechos_normativos"("categoria");
CREATE INDEX IF NOT EXISTS "trechos_normativos_norma_idx" ON "trechos_normativos"("norma");
