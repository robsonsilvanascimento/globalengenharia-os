-- Onda 4: financeiro recorrente (contratos recorrentes + contas a receber).

DO $$ BEGIN
  CREATE TYPE "PeriodicidadeContrato" AS ENUM ('semanal','mensal','bimestral','trimestral','semestral','anual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusContaReceber" AS ENUM ('aberta','paga','vencida','cancelada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "contratos_recorrentes" (
  "id" TEXT NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "periodicidade" "PeriodicidadeContrato" NOT NULL DEFAULT 'mensal',
  "proxima_cobranca_em" TIMESTAMP(3) NOT NULL,
  "data_inicio" TIMESTAMP(3) NOT NULL,
  "data_fim" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contratos_recorrentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contratos_recorrentes_cliente_id_idx" ON "contratos_recorrentes"("cliente_id");
CREATE INDEX IF NOT EXISTS "contratos_recorrentes_ativo_idx" ON "contratos_recorrentes"("ativo");

CREATE TABLE IF NOT EXISTS "contas_receber" (
  "id" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "cliente_id" TEXT NOT NULL,
  "contrato_id" TEXT,
  "descricao" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "vencimento_em" TIMESTAMP(3) NOT NULL,
  "status" "StatusContaReceber" NOT NULL DEFAULT 'aberta',
  "pago_em" TIMESTAMP(3),
  "valor_pago" DOUBLE PRECISION,
  "forma_pagamento" TEXT,
  "observacao" TEXT,
  "criado_por_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contas_receber_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contas_receber_numero_key" ON "contas_receber"("numero");
CREATE INDEX IF NOT EXISTS "contas_receber_cliente_id_idx" ON "contas_receber"("cliente_id");
CREATE INDEX IF NOT EXISTS "contas_receber_status_idx" ON "contas_receber"("status");
CREATE INDEX IF NOT EXISTS "contas_receber_contrato_id_idx" ON "contas_receber"("contrato_id");
CREATE INDEX IF NOT EXISTS "contas_receber_vencimento_em_idx" ON "contas_receber"("vencimento_em");

ALTER TABLE "contratos_recorrentes"
  ADD CONSTRAINT "contratos_recorrentes_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contas_receber"
  ADD CONSTRAINT "contas_receber_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contas_receber"
  ADD CONSTRAINT "contas_receber_contrato_id_fkey"
  FOREIGN KEY ("contrato_id") REFERENCES "contratos_recorrentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Idempotencia do faturamento recorrente: no maximo uma conta por
-- contrato/vencimento. Contas avulsas (contrato_id NULL) nao conflitam.
CREATE UNIQUE INDEX IF NOT EXISTS "contas_receber_contrato_id_vencimento_em_key"
  ON "contas_receber"("contrato_id", "vencimento_em");
