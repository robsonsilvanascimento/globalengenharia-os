-- Campos estruturados do laudo tecnico: subtitulo (local/objeto exibido na capa)
-- e normas aplicaveis (lista exibida na pagina de sumario). Ambos opcionais para
-- nao quebrar laudos ja emitidos.
ALTER TABLE "laudos" ADD COLUMN IF NOT EXISTS "subtitulo" TEXT;
ALTER TABLE "laudos" ADD COLUMN IF NOT EXISTS "normas_aplicaveis" TEXT;
