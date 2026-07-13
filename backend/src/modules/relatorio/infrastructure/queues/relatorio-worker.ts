import { Worker } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { GerarRelatorioGerencialUseCase } from '../../application/GerarRelatorioGerencialUseCase';
import type { RelatorioGerencialJobData } from './relatorio-queue';

const useCase = new GerarRelatorioGerencialUseCase({ prisma });

export const relatorioWorker = new Worker<RelatorioGerencialJobData>(
  'relatorio-gerencial',
  async (job) => {
    const { configId } = job.data;
    await useCase.execute(configId);
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
