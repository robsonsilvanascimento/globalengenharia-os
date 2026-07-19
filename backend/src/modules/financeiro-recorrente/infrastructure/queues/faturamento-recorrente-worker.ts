import { Queue, Worker } from 'bullmq';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { GerarCobrancasRecorrentesUseCase } from '../../application/GerarCobrancasRecorrentesUseCase';
import { PrismaContaReceberRepository } from '../PrismaContaReceberRepository';
import { PrismaContratoRecorrenteRepository } from '../PrismaContratoRecorrenteRepository';

export const faturamentoRecorrenteQueue = new Queue('faturamento-recorrente', {
  connection: redisConnection,
});

/** Agenda a passada diaria (08:10) de faturamento dos contratos recorrentes. */
export function agendarFaturamentoRecorrente(queue: Queue): void {
  queue.add(
    'faturar-contratos',
    {},
    {
      repeat: { pattern: '10 8 * * *' },
      jobId: 'faturamento-recorrente-cron',
    },
  );
}

export const faturamentoRecorrenteWorker = new Worker(
  'faturamento-recorrente',
  async () => {
    const contaReceberRepository = new PrismaContaReceberRepository(prisma);
    const contratoRecorrenteRepository = new PrismaContratoRecorrenteRepository(prisma);
    const gerar = new GerarCobrancasRecorrentesUseCase({
      contratoRecorrenteRepository,
      contaReceberRepository,
    });

    const agora = new Date();
    const resultado = await gerar.execute(agora);
    // Marca como vencidas as contas em aberto cujo vencimento ja passou.
    const vencidas = await contaReceberRepository.marcarVencidasAntesDe(new Date(agora.toISOString().slice(0, 10)));

    return { ...resultado, contasVencidas: vencidas };
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
