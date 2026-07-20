import type { PrismaClient } from '@prisma/client';
import { logger } from '../../../shared/infra/Logger';
import { enqueueCalcularComissao, enqueueEntregaRecibo } from '../../../shared/infra/queues';
import type { PaymentGateway } from '../domain/PaymentGateway';
import type { WebhookEventRepository } from '../domain/WebhookEventRepository';

export interface ProcessarWebhookPagamentoInput {
  webhookEventId: string;
}

/** Motivo estavel de por que o webhook nao resultou em confirmacao de pagamento (para log/observabilidade). */
export type MotivoNaoProcessado =
  | 'evento_nao_encontrado'
  | 'pagamento_nao_encontrado_no_gateway'
  | 'status_nao_aprovado'
  | 'pagamento_os_nao_encontrado'
  | 'ja_confirmado'
  | 'pagamento_os_cancelado'
  | 'valor_divergente';

export interface ProcessarWebhookPagamentoResultado {
  processado: boolean;
  motivo?: MotivoNaoProcessado;
}

const TOLERANCIA_VALOR = 0.01;

/**
 * Processa (fora do request HTTP, via worker) um evento de webhook de
 * pagamento ja registrado no Inbox. Nunca confia no payload do webhook por si
 * so: sempre reconsulta o pagamento diretamente no gateway antes de confirmar
 * qualquer coisa. Idempotente pelo ESTADO do PagamentoOS (nao pelo evento em
 * si) — processar o mesmo evento (ou eventos duplicados do mesmo pagamento)
 * mais de uma vez e seguro e nao reenvia comissao/recibo.
 *
 * Erros inesperados (gateway fora do ar, banco indisponivel) propagam para o
 * chamador (o worker) decidir sobre retry — so os desfechos de negocio
 * "nao ha o que fazer" (ja pago, cancelado, valor divergente, etc.) sao
 * tratados aqui e resultam em retorno normal, sem excecao.
 */
export class ProcessarWebhookPagamentoUseCase {
  constructor(
    private readonly deps: {
      prisma: PrismaClient;
      gateway: PaymentGateway;
      webhookEventRepository: WebhookEventRepository;
    },
  ) {}

  async execute(input: ProcessarWebhookPagamentoInput): Promise<ProcessarWebhookPagamentoResultado> {
    const { prisma, gateway, webhookEventRepository } = this.deps;

    const evento = await webhookEventRepository.buscarPorId(input.webhookEventId);
    if (!evento) {
      logger.warn({ webhookEventId: input.webhookEventId }, 'Evento de webhook de pagamento nao encontrado no Inbox');
      return { processado: false, motivo: 'evento_nao_encontrado' };
    }

    // Nunca confia apenas no payload do webhook: reconsulta o pagamento
    // diretamente no gateway antes de confirmar qualquer coisa.
    const pagamentoExterno = await gateway.consultarPagamento(evento.idExterno);
    if (!pagamentoExterno) {
      await webhookEventRepository.marcarIgnorado(evento.id, 'pagamento_nao_encontrado_no_gateway');
      return { processado: false, motivo: 'pagamento_nao_encontrado_no_gateway' };
    }

    if (pagamentoExterno.status !== 'aprovado') {
      await webhookEventRepository.marcarIgnorado(evento.id, 'status_nao_aprovado');
      return { processado: false, motivo: 'status_nao_aprovado' };
    }

    const pagamentoOS = await prisma.pagamentoOS.findFirst({
      where: { mercadoPagoId: pagamentoExterno.idExterno },
    });

    if (!pagamentoOS) {
      await webhookEventRepository.marcarIgnorado(evento.id, 'pagamento_os_nao_encontrado');
      return { processado: false, motivo: 'pagamento_os_nao_encontrado' };
    }

    // O Mercado Pago pode reentregar o mesmo webhook (ex.: nossa resposta
    // anterior nao chegou a tempo) — cada entrega vira uma linha propria no
    // Inbox e um job proprio. Dois jobs do MESMO pagamento podem rodar em
    // paralelo (o worker roda com concorrencia > 1): sem serializar, ambos
    // liam "pendente" antes de qualquer um escrever "pago", e ambos
    // disparariam comissao/recibo — duplicando o pagamento da comissao do
    // tecnico e reenviando o recibo ao cliente. O lock advisory (mesma
    // tecnica do GerarOuReutilizarPixUseCase) serializa por pagamento: o
    // segundo job so segue apos o primeiro commitar, e nesse ponto ja ve o
    // estado atualizado.
    const resultado = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pagamentoOS.id}))`;

        const atual = await tx.pagamentoOS.findUniqueOrThrow({ where: { id: pagamentoOS.id } });

        if (atual.statusPagamento === 'pago') {
          return { acao: 'ja_confirmado' as const };
        }

        if (atual.statusPagamento === 'cancelado') {
          // Um admin pode ter cancelado este pagamento manualmente apos o Pix
          // ter sido gerado. Se o cliente pagar mesmo assim e o webhook
          // chegar depois, nao reverte a decisao do admin silenciosamente —
          // fica para revisao manual.
          return { acao: 'cancelado' as const };
        }

        const diferenca = Math.abs(pagamentoExterno.valor - atual.valor);
        if (diferenca > TOLERANCIA_VALOR) {
          return { acao: 'valor_divergente' as const, valorEsperado: atual.valor };
        }

        await tx.pagamentoOS.update({
          where: { id: atual.id },
          data: { statusPagamento: 'pago', pagoEm: new Date() },
        });
        await tx.ordemServico.update({
          where: { id: atual.ordemServicoId },
          data: { statusPagamento: 'pago' },
        });

        return { acao: 'confirmado' as const };
      },
      // Timeout maior que o padrao (5s): pode esperar o lock de outro job do
      // mesmo pagamento liberar.
      { timeout: 15000 },
    );

    switch (resultado.acao) {
      case 'ja_confirmado':
        await webhookEventRepository.marcarProcessado(evento.id);
        return { processado: false, motivo: 'ja_confirmado' };

      case 'cancelado':
        logger.warn(
          { pagamentoOSId: pagamentoOS.id },
          'Webhook de pagamento aprovado recebido para um PagamentoOS ja cancelado - ignorado, requer revisao manual',
        );
        await webhookEventRepository.marcarIgnorado(evento.id, 'pagamento_os_cancelado');
        return { processado: false, motivo: 'pagamento_os_cancelado' };

      case 'valor_divergente':
        logger.error(
          { pagamentoOSId: pagamentoOS.id, valorEsperado: resultado.valorEsperado, valorPago: pagamentoExterno.valor },
          'Valor pago no gateway diverge do valor cobrado - pagamento NAO confirmado automaticamente, requer revisao manual',
        );
        await webhookEventRepository.marcarIgnorado(evento.id, 'valor_divergente');
        return { processado: false, motivo: 'valor_divergente' };

      case 'confirmado':
        await enqueueCalcularComissao({ pagamentoOSId: pagamentoOS.id });
        await enqueueEntregaRecibo({ pagamentoOSId: pagamentoOS.id });
        await webhookEventRepository.marcarProcessado(evento.id);
        return { processado: true };
    }
  }
}
