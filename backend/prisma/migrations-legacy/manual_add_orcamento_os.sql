-- Tipo de chamado na OS (emergencia | servico), default servico.
ALTER TABLE "ordens_servico" ADD COLUMN IF NOT EXISTS "tipo_chamado" TEXT NOT NULL DEFAULT 'servico';

-- Orcamento (proposta de preco) enviado ao cliente para aprovacao.
CREATE TABLE IF NOT EXISTS "orcamentos_os" (
  "id" TEXT NOT NULL,
  "ordem_servico_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "valor_total" DECIMAL(10,2) NOT NULL,
  "itens" JSONB NOT NULL,
  "observacao" TEXT,
  "token_aprovacao" TEXT NOT NULL,
  "enviado_em" TIMESTAMP(3),
  "respondido_em" TIMESTAMP(3),
  "criado_por_id" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orcamentos_os_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "orcamentos_os_ordem_servico_id_key" ON "orcamentos_os"("ordem_servico_id");
CREATE UNIQUE INDEX IF NOT EXISTS "orcamentos_os_token_aprovacao_key" ON "orcamentos_os"("token_aprovacao");

ALTER TABLE "orcamentos_os"
  ADD CONSTRAINT "orcamentos_os_ordem_servico_id_fkey"
  FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamentos_os"
  ADD CONSTRAINT "orcamentos_os_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
