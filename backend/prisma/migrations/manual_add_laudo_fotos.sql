-- Fotos do relatorio fotografico de um laudo. O binario fica no armazenamento
-- de arquivos; aqui guardamos a chave logica, a legenda e a ordem.
CREATE TABLE IF NOT EXISTS "laudo_fotos" (
  "id" TEXT NOT NULL,
  "laudo_id" TEXT NOT NULL,
  "chave_arquivo" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "legenda" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "laudo_fotos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "laudo_fotos_laudo_id_idx" ON "laudo_fotos"("laudo_id");

ALTER TABLE "laudo_fotos"
  ADD CONSTRAINT "laudo_fotos_laudo_id_fkey"
  FOREIGN KEY ("laudo_id") REFERENCES "laudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
