import { Worker } from 'bullmq';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { enqueueNotificacaoWhatsapp } from '../../../../shared/infra/queues';
import type { AlertaEstoqueJobData } from './alerta-estoque-queue';

export const alertaEstoqueWorker = new Worker<AlertaEstoqueJobData>(
  'alerta-estoque',
  async (job) => {
    const { pecaId, estoqueAtual, estoqueMinimo } = job.data;

    const peca = await prisma.peca.findUnique({ where: { id: pecaId } });
    if (!peca) return;

    if (peca.estoqueAtual > estoqueMinimo) return;

    const admin = await prisma.usuario.findFirst({
      where: { papel: 'admin', ativo: true },
    });
    if (!admin) return;

    const mensagem = `⚠️ Estoque baixo: ${peca.nome} (${peca.codigo}) — ${estoqueAtual} ${peca.unidade} em estoque (mínimo: ${estoqueMinimo})`;

    await enqueueNotificacaoWhatsapp({
      ordemServicoId: '',
      clienteId: admin.id,
      statusNovo: 'alerta_estoque',
      templateNome: mensagem,
    });

    logger.info({ pecaId, estoqueAtual, estoqueMinimo }, 'Alerta de estoque enfileirado');
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
