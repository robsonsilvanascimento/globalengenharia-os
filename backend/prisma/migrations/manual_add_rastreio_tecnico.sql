-- Onda 5: rastreio do tecnico (a caminho / check-in GPS) + coordenadas na OS.

ALTER TABLE "ordens_servico" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "ordens_servico" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

DO $$ BEGIN
  CREATE TYPE "TipoRastreioOS" AS ENUM ('a_caminho','chegada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "rastreios_tecnico_os" (
  "id" TEXT NOT NULL,
  "ordem_servico_id" TEXT NOT NULL,
  "tecnico_id" TEXT NOT NULL,
  "tipo" "TipoRastreioOS" NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rastreios_tecnico_os_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rastreios_tecnico_os_ordem_servico_id_idx" ON "rastreios_tecnico_os"("ordem_servico_id");
CREATE INDEX IF NOT EXISTS "rastreios_tecnico_os_tecnico_id_idx" ON "rastreios_tecnico_os"("tecnico_id");

ALTER TABLE "rastreios_tecnico_os"
  ADD CONSTRAINT "rastreios_tecnico_os_ordem_servico_id_fkey"
  FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rastreios_tecnico_os"
  ADD CONSTRAINT "rastreios_tecnico_os_tecnico_id_fkey"
  FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
