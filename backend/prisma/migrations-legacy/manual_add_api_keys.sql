CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "hash" TEXT NOT NULL UNIQUE,
  "prefixo" TEXT NOT NULL,
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  "criado_por_id" TEXT NOT NULL REFERENCES "usuarios"("id"),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo_uso_em" TIMESTAMP(3)
);
