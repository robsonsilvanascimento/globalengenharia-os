import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { QUEUE_NAMES, type EntregaReciboJobData } from '../../../../shared/infra/queues';
import { gerarReciboPagamento } from '../../../../shared/infra/pdf/GerarReciboPagamentoService';
import { enviarDocumento } from '../../../whatsapp/infrastructure/MetaCloudApiClient';

const ENTREGA_RECIBO_WORKER_CONCURRENCY = 5;
const CAPTION_WHATSAPP = 'Recibo do seu pagamento em anexo';

function buildFilename(numeroOS: string): string {
  return `recibo-${numeroOS}.pdf`;
}

/**
 * Processa um job da fila `entrega-recibo`: busca o pagamento confirmado, a
 * OS e o cliente, gera o PDF do recibo (`gerarReciboPagamento`) e entrega via
 * WhatsApp. Falha de dados inconsistentes (pagamento/OS/cliente nao
 * encontrados) relanca o erro para retry do BullMQ; falha apenas no envio
 * via WhatsApp e logada, sem relancar (nao ha canal alternativo de entrega
 * aqui, mas nao faz sentido re-tentar indefinidamente um recibo que o
 * cliente pode pedir de novo pelo bot se precisar).
 */
export async function processarEntregaReciboJob(job: Job<EntregaReciboJobData>): Promise<void> {
  const { pagamentoOSId } = job.data;

  const pagamentoOS = await prisma.pagamentoOS.findUnique({
    where: { id: pagamentoOSId },
    include: {
      ordemServico: { include: { cliente: { select: { nome: true, telefoneWhatsapp: true } } } },
    },
  });

  if (!pagamentoOS) {
    logger.error({ pagamentoOSId }, 'PagamentoOS nao encontrado para entrega de recibo');
    throw new Error(`PagamentoOS ${pagamentoOSId} nao encontrado para entrega de recibo`);
  }

  if (pagamentoOS.statusPagamento !== 'pago') {
    logger.info({ pagamentoOSId }, 'PagamentoOS ainda nao esta pago - recibo nao enviado');
    return;
  }

  const { ordemServico } = pagamentoOS;
  const { cliente } = ordemServico;

  const pdf = await gerarReciboPagamento({
    numeroOS: ordemServico.numero,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefoneWhatsapp,
    valor: pagamentoOS.valor,
    tipoPagamento: pagamentoOS.tipo,
    pagoEm: pagamentoOS.pagoEm ?? new Date(),
  });

  const resultado = await enviarDocumento(
    cliente.telefoneWhatsapp,
    pdf,
    buildFilename(ordemServico.numero),
    'application/pdf',
    CAPTION_WHATSAPP,
  );

  if (!resultado.sucesso) {
    logger.error(
      { pagamentoOSId, erro: resultado.erro },
      'Falha ao entregar recibo de pagamento via WhatsApp',
    );
    return;
  }

  logger.info(
    { pagamentoOSId, messageId: resultado.messageId },
    'Recibo de pagamento entregue via WhatsApp com sucesso',
  );
}

/** Cria o Worker BullMQ que consome a fila `entrega-recibo`. */
export function createEntregaReciboWorker(): Worker<EntregaReciboJobData> {
  const worker = new Worker<EntregaReciboJobData>(
    QUEUE_NAMES.ENTREGA_RECIBO,
    (job) => processarEntregaReciboJob(job),
    {
      connection: redisConnection,
      concurrency: ENTREGA_RECIBO_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job da fila entrega-recibo falhou');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila entrega-recibo');
  });

  return worker;
}
