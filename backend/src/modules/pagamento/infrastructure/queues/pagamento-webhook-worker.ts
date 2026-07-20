import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { QUEUE_NAMES, type ProcessarWebhookPagamentoJobData } from '../../../../shared/infra/queues';
import { ProcessarWebhookPagamentoUseCase } from '../../application/ProcessarWebhookPagamentoUseCase';
import { MercadoPagoGatewayAdapter } from '../mercadopago/MercadoPagoGatewayAdapter';
import { PrismaWebhookEventRepository } from '../PrismaWebhookEventRepository';

const WEBHOOK_PAGAMENTO_WORKER_CONCURRENCY = 5;

/**
 * Processa um job da fila `processar-webhook-pagamento`: executa o caso de
 * uso que confirma (ou nao) o pagamento a partir do evento ja registrado no
 * Inbox. Erro inesperado (gateway/banco indisponivel) e registrado no evento
 * como falha e relancado, para o BullMQ tratar o retry/backoff.
 */
export async function processarWebhookPagamentoJob(job: Job<ProcessarWebhookPagamentoJobData>): Promise<void> {
  const { webhookEventId } = job.data;
  const webhookEventRepository = new PrismaWebhookEventRepository(prisma);

  const useCase = new ProcessarWebhookPagamentoUseCase({
    prisma,
    gateway: new MercadoPagoGatewayAdapter(),
    webhookEventRepository,
  });

  try {
    const resultado = await useCase.execute({ webhookEventId });
    logger.info({ webhookEventId, ...resultado }, 'Webhook de pagamento processado');
  } catch (err) {
    try {
      await webhookEventRepository.marcarFalhou(webhookEventId, err instanceof Error ? err.message : String(err));
    } catch (marcarErr) {
      // Nao deixa uma falha ao registrar o erro mascarar o erro original.
      logger.error({ webhookEventId, marcarErr }, 'Falha ao marcar evento de webhook de pagamento como falho');
    }
    throw err;
  }
}

/** Cria o Worker BullMQ que consome a fila `processar-webhook-pagamento`. */
export function createPagamentoWebhookWorker(): Worker<ProcessarWebhookPagamentoJobData> {
  const worker = new Worker<ProcessarWebhookPagamentoJobData>(
    QUEUE_NAMES.PROCESSAR_WEBHOOK_PAGAMENTO,
    (job) => processarWebhookPagamentoJob(job),
    {
      connection: redisConnection,
      concurrency: WEBHOOK_PAGAMENTO_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job da fila processar-webhook-pagamento falhou');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila processar-webhook-pagamento');
  });

  return worker;
}
