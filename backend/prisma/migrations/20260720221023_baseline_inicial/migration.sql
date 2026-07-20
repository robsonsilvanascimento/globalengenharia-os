-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('atendente', 'tecnico', 'admin', 'ajudante');

-- CreateEnum
CREATE TYPE "AreaServico" AS ENUM ('eletrica', 'automacao', 'energia_solar', 'outro');

-- CreateEnum
CREATE TYPE "PrioridadeOS" AS ENUM ('baixa', 'normal', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "StatusOS" AS ENUM ('aberta', 'triagem', 'atribuida', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "CriadoVia" AS ENUM ('whatsapp', 'painel');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "StatusEnvioNotificacao" AS ENUM ('pendente', 'enviada', 'falhou');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoAtendimento" AS ENUM ('pendente', 'respondida');

-- CreateEnum
CREATE TYPE "TipoMidiaOS" AS ENUM ('video');

-- CreateEnum
CREATE TYPE "TipoDocumentoOS" AS ENUM ('certificado_garantia', 'manual', 'laudo_tecnico', 'nota_fiscal', 'foto', 'outro');

-- CreateEnum
CREATE TYPE "TurnoAtendimento" AS ENUM ('diurno', 'noturno');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('pendente', 'pago', 'cancelado');

-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('pix_automatico', 'manual');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('entrada', 'saida');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('criar', 'atualizar', 'apagar', 'consultar');

-- CreateEnum
CREATE TYPE "PeriodicidadeContrato" AS ENUM ('semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');

-- CreateEnum
CREATE TYPE "StatusContaReceber" AS ENUM ('aberta', 'paga', 'vencida', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoRastreioOS" AS ENUM ('a_caminho', 'chegada');

-- CreateEnum
CREATE TYPE "StatusWebhookEventoPagamento" AS ENUM ('pendente', 'processado', 'falhou', 'ignorado');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone_whatsapp" TEXT NOT NULL,
    "documento" TEXT,
    "email" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "telefone" TEXT,
    "valor_hora" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reset_senha_token_hash" TEXT,
    "reset_senha_expira_em" TIMESTAMP(3),
    "expo_push_token" TEXT,
    "comissao_ativa" BOOLEAN NOT NULL DEFAULT false,
    "comissao_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso_em" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_servico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area" "AreaServico" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "categoria_servico_id" TEXT NOT NULL,
    "descricao_problema" TEXT NOT NULL,
    "endereco_atendimento" TEXT,
    "prioridade" "PrioridadeOS" NOT NULL DEFAULT 'normal',
    "status" "StatusOS" NOT NULL DEFAULT 'aberta',
    "tecnico_id" TEXT,
    "ajudante_id" TEXT,
    "criado_por_usuario_id" TEXT,
    "criado_via" "CriadoVia" NOT NULL,
    "data_agendada" TIMESTAMP(3),
    "lembrete_agendamento_enviado_em" TIMESTAMP(3),
    "tipo_chamado" TEXT NOT NULL DEFAULT 'servico',
    "valor_cobrado" DECIMAL(10,2),
    "is_pendente" BOOLEAN NOT NULL DEFAULT false,
    "sla_vencido" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "fechado_em" TIMESTAMP(3),
    "custo_total_pecas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status_pagamento" "StatusPagamento" NOT NULL DEFAULT 'pendente',
    "nps_enviado_em" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googleCalendarEventId" TEXT,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimativas_custo_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "horas_estimadas_tecnico" DECIMAL(10,2) NOT NULL,
    "valor_hora_tecnico" DECIMAL(10,2) NOT NULL,
    "horas_estimadas_ajudante" DECIMAL(10,2),
    "valor_hora_ajudante" DECIMAL(10,2),
    "custo_combustivel" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_pedagio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_desgaste_veiculo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "outros_custos" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_almoco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_janta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_estadia" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "turno" "TurnoAtendimento" NOT NULL DEFAULT 'diurno',
    "custo_adicional_noturno" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "custo_total" DECIMAL(10,2) NOT NULL,
    "custo_pecas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criado_por_usuario_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimativas_custo_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos_os" (
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

-- CreateTable
CREATE TABLE "trechos_normativos" (
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

-- CreateTable
CREATE TABLE "laudos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "ordem_servico_id" TEXT,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "tipo" TEXT NOT NULL,
    "cliente_nome" TEXT,
    "normas_aplicaveis" TEXT,
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

-- CreateTable
CREATE TABLE "laudo_fotos" (
    "id" TEXT NOT NULL,
    "laudo_id" TEXT NOT NULL,
    "chave_arquivo" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "legenda" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laudo_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_status_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "status_anterior" "StatusOS",
    "status_novo" "StatusOS" NOT NULL,
    "alterado_por_usuario_id" TEXT,
    "alterado_por_bot" BOOLEAN NOT NULL,
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas_whatsapp" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "telefone_whatsapp" TEXT NOT NULL,
    "estado_fluxo" TEXT NOT NULL,
    "contexto_dados" JSONB NOT NULL,
    "ordem_servico_id" TEXT,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_whatsapp" (
    "id" TEXT NOT NULL,
    "conversa_id" TEXT NOT NULL,
    "direcao" "DirecaoMensagem" NOT NULL,
    "tipo_conteudo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "whatsapp_message_id" TEXT NOT NULL,
    "status_entrega" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "midias_ordem_servico" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT,
    "cliente_id" TEXT NOT NULL,
    "tipo" "TipoMidiaOS" NOT NULL,
    "caminho_armazenamento" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "whatsapp_media_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "midias_ordem_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "chave" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "notificacoes_enviadas" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipo_evento" TEXT NOT NULL,
    "template_usado" TEXT,
    "status_envio" "StatusEnvioNotificacao" NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMP(3),

    CONSTRAINT "notificacoes_enviadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "tags" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_atendimento" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "conversa_id" TEXT,
    "mensagem_cliente" TEXT NOT NULL,
    "status" "StatusSolicitacaoAtendimento" NOT NULL DEFAULT 'pendente',
    "resposta_texto" TEXT,
    "respondido_por_usuario_id" TEXT,
    "salvar_como_faq" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondido_em" TIMESTAMP(3),

    CONSTRAINT "solicitacoes_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "componentes_instalados" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fabricante" TEXT,
    "modelo" TEXT,
    "numero_serie" TEXT,
    "codigo_barras" TEXT,
    "garantia_meses" INTEGER,
    "garantia_expira_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "criado_por_usuario_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "componentes_instalados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "componente_instalado_id" TEXT,
    "nome" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoOS" NOT NULL,
    "caminho_armazenamento" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "carregado_por_usuario_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "dados_anteriores" JSONB,
    "dados_novos" JSONB,
    "usuario_id" TEXT,
    "nome_usuario" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "descricao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pendencias_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "observacao" TEXT NOT NULL,
    "criado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pendencias_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_pendencia" (
    "id" TEXT NOT NULL,
    "pendencia_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "base64" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_pendencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates_checklist" (
    "id" TEXT NOT NULL,
    "categoria_servico_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_checklist" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_checklist" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "marcado" BOOLEAN NOT NULL DEFAULT false,
    "respondido_por_id" TEXT,
    "respondido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_garantia" (
    "id" TEXT NOT NULL,
    "componente_id" TEXT NOT NULL,
    "dias_restantes" INTEGER NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_garantia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_config" (
    "id" TEXT NOT NULL,
    "prioridade" "PrioridadeOS" NOT NULL,
    "prazo_horas" INTEGER NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_relatorio_gerencial" (
    "id" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL,
    "email_destino" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_relatorio_gerencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_servico_realizado" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "base64" TEXT NOT NULL,
    "legenda" TEXT,
    "momento" TEXT,
    "enviado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_servico_realizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_portal_cliente" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_portal_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_nps" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_nps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "tipo" "TipoPagamento" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status_pagamento" "StatusPagamento" NOT NULL DEFAULT 'pendente',
    "pix_qr_code" TEXT,
    "pix_copia_e_cola" TEXT,
    "mercado_pago_id" TEXT,
    "observacao" TEXT,
    "pago_em" TIMESTAMP(3),
    "criado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comissoes_tecnico" (
    "id" TEXT NOT NULL,
    "tecnico_id" TEXT NOT NULL,
    "pagamento_os_id" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "percentual" DOUBLE PRECISION NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comissoes_tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "imagem_base64" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pecas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'un',
    "preco_unitario" DOUBLE PRECISION NOT NULL,
    "estoque_atual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estoque_minimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pecas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" TEXT NOT NULL,
    "peca_id" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "preco_unitario" DOUBLE PRECISION NOT NULL,
    "ordem_servico_id" TEXT,
    "observacao" TEXT,
    "criado_por_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumos_os_peca" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "peca_id" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "preco_unitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumos_os_peca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manutencoes_preventivas" (
    "id" TEXT NOT NULL,
    "componente_instalado_id" TEXT NOT NULL,
    "intervalo_dias" INTEGER NOT NULL,
    "ultima_realizada_em" TIMESTAMP(3),
    "proxima_em" TIMESTAMP(3) NOT NULL,
    "notificado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manutencoes_preventivas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos_recorrentes" (
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

-- CreateTable
CREATE TABLE "contas_receber" (
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

-- CreateTable
CREATE TABLE "rastreios_tecnico_os" (
    "id" TEXT NOT NULL,
    "ordem_servico_id" TEXT NOT NULL,
    "tecnico_id" TEXT NOT NULL,
    "tipo" "TipoRastreioOS" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rastreios_tecnico_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_eventos_pagamento" (
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

-- CreateIndex
CREATE UNIQUE INDEX "clientes_telefone_whatsapp_key" ON "clientes"("telefone_whatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_reset_senha_token_hash_idx" ON "usuarios"("reset_senha_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "ordens_servico"("numero");

-- CreateIndex
CREATE INDEX "ordens_servico_status_idx" ON "ordens_servico"("status");

-- CreateIndex
CREATE INDEX "ordens_servico_tecnico_id_idx" ON "ordens_servico"("tecnico_id");

-- CreateIndex
CREATE INDEX "ordens_servico_ajudante_id_idx" ON "ordens_servico"("ajudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimativas_custo_os_ordem_servico_id_key" ON "estimativas_custo_os"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_os_ordem_servico_id_key" ON "orcamentos_os"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_os_token_aprovacao_key" ON "orcamentos_os"("token_aprovacao");

-- CreateIndex
CREATE INDEX "trechos_normativos_categoria_idx" ON "trechos_normativos"("categoria");

-- CreateIndex
CREATE INDEX "trechos_normativos_norma_idx" ON "trechos_normativos"("norma");

-- CreateIndex
CREATE UNIQUE INDEX "laudos_numero_key" ON "laudos"("numero");

-- CreateIndex
CREATE INDEX "laudos_ordem_servico_id_idx" ON "laudos"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "laudo_fotos_laudo_id_idx" ON "laudo_fotos"("laudo_id");

-- CreateIndex
CREATE INDEX "historico_status_os_ordem_servico_id_idx" ON "historico_status_os"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "conversas_whatsapp_cliente_id_idx" ON "conversas_whatsapp"("cliente_id");

-- CreateIndex
CREATE INDEX "conversas_whatsapp_telefone_whatsapp_idx" ON "conversas_whatsapp"("telefone_whatsapp");

-- CreateIndex
CREATE UNIQUE INDEX "mensagens_whatsapp_whatsapp_message_id_key" ON "mensagens_whatsapp"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "mensagens_whatsapp_conversa_id_idx" ON "mensagens_whatsapp"("conversa_id");

-- CreateIndex
CREATE INDEX "midias_ordem_servico_ordem_servico_id_idx" ON "midias_ordem_servico"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "notificacoes_enviadas_ordem_servico_id_idx" ON "notificacoes_enviadas"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "notificacoes_enviadas_cliente_id_idx" ON "notificacoes_enviadas"("cliente_id");

-- CreateIndex
CREATE INDEX "solicitacoes_atendimento_status_idx" ON "solicitacoes_atendimento"("status");

-- CreateIndex
CREATE INDEX "componentes_instalados_ordem_servico_id_idx" ON "componentes_instalados"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "componentes_instalados_numero_serie_idx" ON "componentes_instalados"("numero_serie");

-- CreateIndex
CREATE INDEX "documentos_os_ordem_servico_id_idx" ON "documentos_os"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "documentos_os_componente_instalado_id_idx" ON "documentos_os"("componente_instalado_id");

-- CreateIndex
CREATE INDEX "audit_log_entidade_entidade_id_idx" ON "audit_log"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "audit_log_usuario_id_idx" ON "audit_log"("usuario_id");

-- CreateIndex
CREATE INDEX "audit_log_criado_em_idx" ON "audit_log"("criado_em");

-- CreateIndex
CREATE INDEX "pendencias_os_ordem_servico_id_idx" ON "pendencias_os"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "fotos_pendencia_pendencia_id_idx" ON "fotos_pendencia"("pendencia_id");

-- CreateIndex
CREATE INDEX "templates_checklist_categoria_servico_id_idx" ON "templates_checklist"("categoria_servico_id");

-- CreateIndex
CREATE INDEX "respostas_checklist_ordem_servico_id_idx" ON "respostas_checklist"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_checklist_ordem_servico_id_item_id_key" ON "respostas_checklist"("ordem_servico_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "sla_config_prioridade_key" ON "sla_config"("prioridade");

-- CreateIndex
CREATE INDEX "fotos_servico_realizado_ordem_servico_id_idx" ON "fotos_servico_realizado"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_portal_cliente_token_key" ON "tokens_portal_cliente"("token");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_nps_ordem_servico_id_key" ON "respostas_nps"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "comissoes_tecnico_pagamento_os_id_key" ON "comissoes_tecnico"("pagamento_os_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_os_ordem_servico_id_key" ON "assinaturas_os"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "pecas_codigo_key" ON "pecas"("codigo");

-- CreateIndex
CREATE INDEX "contratos_recorrentes_cliente_id_idx" ON "contratos_recorrentes"("cliente_id");

-- CreateIndex
CREATE INDEX "contratos_recorrentes_ativo_idx" ON "contratos_recorrentes"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "contas_receber_numero_key" ON "contas_receber"("numero");

-- CreateIndex
CREATE INDEX "contas_receber_cliente_id_idx" ON "contas_receber"("cliente_id");

-- CreateIndex
CREATE INDEX "contas_receber_status_idx" ON "contas_receber"("status");

-- CreateIndex
CREATE INDEX "contas_receber_contrato_id_idx" ON "contas_receber"("contrato_id");

-- CreateIndex
CREATE INDEX "contas_receber_vencimento_em_idx" ON "contas_receber"("vencimento_em");

-- CreateIndex
CREATE UNIQUE INDEX "contas_receber_contrato_id_vencimento_em_key" ON "contas_receber"("contrato_id", "vencimento_em");

-- CreateIndex
CREATE INDEX "rastreios_tecnico_os_ordem_servico_id_idx" ON "rastreios_tecnico_os"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "rastreios_tecnico_os_tecnico_id_idx" ON "rastreios_tecnico_os"("tecnico_id");

-- CreateIndex
CREATE INDEX "webhook_eventos_pagamento_provedor_id_externo_idx" ON "webhook_eventos_pagamento"("provedor", "id_externo");

-- CreateIndex
CREATE INDEX "webhook_eventos_pagamento_status_idx" ON "webhook_eventos_pagamento"("status");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_categoria_servico_id_fkey" FOREIGN KEY ("categoria_servico_id") REFERENCES "categorias_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_ajudante_id_fkey" FOREIGN KEY ("ajudante_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimativas_custo_os" ADD CONSTRAINT "estimativas_custo_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimativas_custo_os" ADD CONSTRAINT "estimativas_custo_os_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos_os" ADD CONSTRAINT "orcamentos_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos_os" ADD CONSTRAINT "orcamentos_os_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laudos" ADD CONSTRAINT "laudos_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laudo_fotos" ADD CONSTRAINT "laudo_fotos_laudo_id_fkey" FOREIGN KEY ("laudo_id") REFERENCES "laudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status_os" ADD CONSTRAINT "historico_status_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status_os" ADD CONSTRAINT "historico_status_os_alterado_por_usuario_id_fkey" FOREIGN KEY ("alterado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas_whatsapp" ADD CONSTRAINT "conversas_whatsapp_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas_whatsapp" ADD CONSTRAINT "conversas_whatsapp_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas_whatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "midias_ordem_servico" ADD CONSTRAINT "midias_ordem_servico_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "midias_ordem_servico" ADD CONSTRAINT "midias_ordem_servico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_enviadas" ADD CONSTRAINT "notificacoes_enviadas_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_enviadas" ADD CONSTRAINT "notificacoes_enviadas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_atendimento" ADD CONSTRAINT "solicitacoes_atendimento_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_atendimento" ADD CONSTRAINT "solicitacoes_atendimento_conversa_id_fkey" FOREIGN KEY ("conversa_id") REFERENCES "conversas_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes_atendimento" ADD CONSTRAINT "solicitacoes_atendimento_respondido_por_usuario_id_fkey" FOREIGN KEY ("respondido_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "componentes_instalados" ADD CONSTRAINT "componentes_instalados_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "componentes_instalados" ADD CONSTRAINT "componentes_instalados_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_os" ADD CONSTRAINT "documentos_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_os" ADD CONSTRAINT "documentos_os_componente_instalado_id_fkey" FOREIGN KEY ("componente_instalado_id") REFERENCES "componentes_instalados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_os" ADD CONSTRAINT "documentos_os_carregado_por_usuario_id_fkey" FOREIGN KEY ("carregado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_os" ADD CONSTRAINT "pendencias_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pendencias_os" ADD CONSTRAINT "pendencias_os_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_pendencia" ADD CONSTRAINT "fotos_pendencia_pendencia_id_fkey" FOREIGN KEY ("pendencia_id") REFERENCES "pendencias_os"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates_checklist" ADD CONSTRAINT "templates_checklist_categoria_servico_id_fkey" FOREIGN KEY ("categoria_servico_id") REFERENCES "categorias_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_checklist" ADD CONSTRAINT "itens_checklist_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates_checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_checklist" ADD CONSTRAINT "respostas_checklist_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_checklist" ADD CONSTRAINT "respostas_checklist_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itens_checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_checklist" ADD CONSTRAINT "respostas_checklist_respondido_por_id_fkey" FOREIGN KEY ("respondido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_garantia" ADD CONSTRAINT "alertas_garantia_componente_id_fkey" FOREIGN KEY ("componente_id") REFERENCES "componentes_instalados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_servico_realizado" ADD CONSTRAINT "fotos_servico_realizado_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_servico_realizado" ADD CONSTRAINT "fotos_servico_realizado_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_portal_cliente" ADD CONSTRAINT "tokens_portal_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_nps" ADD CONSTRAINT "respostas_nps_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_nps" ADD CONSTRAINT "respostas_nps_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_os" ADD CONSTRAINT "pagamentos_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_os" ADD CONSTRAINT "pagamentos_os_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes_tecnico" ADD CONSTRAINT "comissoes_tecnico_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comissoes_tecnico" ADD CONSTRAINT "comissoes_tecnico_pagamento_os_id_fkey" FOREIGN KEY ("pagamento_os_id") REFERENCES "pagamentos_os"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas_os" ADD CONSTRAINT "assinaturas_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "pecas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_os_peca" ADD CONSTRAINT "consumos_os_peca_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumos_os_peca" ADD CONSTRAINT "consumos_os_peca_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "pecas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manutencoes_preventivas" ADD CONSTRAINT "manutencoes_preventivas_componente_instalado_id_fkey" FOREIGN KEY ("componente_instalado_id") REFERENCES "componentes_instalados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos_recorrentes" ADD CONSTRAINT "contratos_recorrentes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_receber" ADD CONSTRAINT "contas_receber_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_receber" ADD CONSTRAINT "contas_receber_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos_recorrentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rastreios_tecnico_os" ADD CONSTRAINT "rastreios_tecnico_os_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rastreios_tecnico_os" ADD CONSTRAINT "rastreios_tecnico_os_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
