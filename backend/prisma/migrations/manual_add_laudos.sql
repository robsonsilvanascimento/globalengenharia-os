CREATE TABLE IF NOT EXISTS "laudos" (
  "id" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "ordem_servico_id" TEXT,
  "titulo" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "cliente_nome" TEXT,
  "conteudo" TEXT NOT NULL,
  "responsavel_nome" TEXT,
  "responsavel_crea" TEXT,
  "art_numero" TEXT,
  "emitido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "laudos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "laudos_numero_key" ON "laudos"("numero");
CREATE INDEX IF NOT EXISTS "laudos_ordem_servico_id_idx" ON "laudos"("ordem_servico_id");

ALTER TABLE "laudos"
  ADD CONSTRAINT "laudos_ordem_servico_id_fkey"
  FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
