import { Worker } from 'bullmq';
import { randomBytes } from 'crypto';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { enqueueNotificacaoWhatsapp } from '../../../../shared/infra/queues/index';
import { saveNpsToken } from '../tokens/TokenNpsStore';
import type { NpsJobData } from './nps-queue';

export const npsWorker = new Worker<NpsJobData>(
  'nps-pesquisa',
  async (job) => {
    const { ordemServicoId, clienteId } = job.data;

    const os = await prisma.ordemServico.findUnique({
      where: { id: ordemServicoId },
      select: { npsEnviadoEm: true },
    });

    if (!os || os.npsEnviadoEm) return;

    const jaRespondido = await prisma.respostaNPS.findUnique({
      where: { ordemServicoId },
    });

    if (jaRespondido) return;

    const token = randomBytes(16).toString('hex');

    await saveNpsToken(redisConnection, token, ordemServicoId);

    await prisma.ordemServico.update({
      where: { id: ordemServicoId },
      data: { npsEnviadoEm: new Date() },
    });

    const link = `${process.env.FRONTEND_URL}/nps/${token}`;

    await enqueueNotificacaoWhatsapp({
      ordemServicoId,
      clienteId,
      statusNovo: 'nps_pesquisa',
      templateNome: `Olá! Gostaríamos de saber sua opinião sobre o atendimento. Avalie em: ${link}`,
    });
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);
