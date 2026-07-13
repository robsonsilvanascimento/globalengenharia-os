import { Worker } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { prisma } from '../../../../shared/infra/PrismaClient';

const STATUSES_ATIVOS = ['aberta', 'triagem', 'atribuida', 'em_andamento', 'aguardando_peca'] as const;

export const slaWorker = new Worker(
  'sla-verificacao',
  async () => {
    const configs = await prisma.slaConfig.findMany();
    const prazoMap = new Map<string, number>(
      configs.map((c) => [c.prioridade, c.prazoHoras * 3_600_000]),
    );

    let skip = 0;
    const take = 100;

    while (true) {
      const lote = await prisma.ordemServico.findMany({
        where: { status: { in: [...STATUSES_ATIVOS] }, slaVencido: false },
        skip,
        take,
        select: { id: true, prioridade: true, criadoEm: true },
      });

      if (lote.length === 0) break;

      const agora = Date.now();
      const vencidas = lote.filter(
        (os) => agora > os.criadoEm.getTime() + (prazoMap.get(os.prioridade) ?? Infinity),
      );

      await Promise.all(
        vencidas.map((os) =>
          prisma.ordemServico.update({ where: { id: os.id }, data: { slaVencido: true } }),
        ),
      );

      if (lote.length < take) break;
      skip += take;
    }
  },
  { connection: redisConnection },
);
