import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { QUEUE_NAMES, type CalcularComissaoJobData } from '../../../../shared/infra/queues';
import { prisma } from '../../../../shared/infra/PrismaClient';

export async function processarComissaoJob(job: Job<CalcularComissaoJobData>): Promise<void> {
  const { pagamentoOSId } = job.data;

  const pagamento = await prisma.pagamentoOS.findUnique({
    where: { id: pagamentoOSId },
    select: {
      id: true,
      valor: true,
      ordemServico: { select: { tecnicoId: true } },
    },
  });

  if (!pagamento) {
    logger.warn({ pagamentoOSId }, 'PagamentoOS nao encontrado para calculo de comissao');
    return;
  }

  const tecnicoId = pagamento.ordemServico.tecnicoId;

  if (!tecnicoId) {
    logger.info({ pagamentoOSId }, 'OS sem tecnico, comissao ignorada');
    return;
  }

  const tecnico = await prisma.usuario.findUnique({
    where: { id: tecnicoId },
    select: { comissaoAtiva: true, comissaoPct: true },
  });

  if (!tecnico || tecnico.comissaoAtiva === false || tecnico.comissaoPct === 0) {
    logger.info({ pagamentoOSId, tecnicoId }, 'Comissao inativa ou percentual zero, ignorado');
    return;
  }

  await prisma.comissaoTecnico.create({
    data: {
      tecnicoId,
      pagamentoOSId,
      valor: pagamento.valor * (tecnico.comissaoPct / 100),
      percentual: tecnico.comissaoPct,
    },
  });

  logger.info({ pagamentoOSId, tecnicoId, percentual: tecnico.comissaoPct }, 'Comissao calculada');
}

export function createComissaoWorker(): Worker<CalcularComissaoJobData> {
  return new Worker<CalcularComissaoJobData>(
    QUEUE_NAMES.CALCULAR_COMISSAO,
    (job) => processarComissaoJob(job),
    { connection: redisConnection },
  );
}
