import { Worker } from 'bullmq';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { enqueueExpoPush } from '../../../notificacoes/infrastructure/queues/expo-push-queue';
import type { AlertaEstoqueJobData } from './alerta-estoque-queue';

/**
 * Processa o alerta de estoque baixo de uma peca: reconfere no banco que ela
 * ainda esta no/abaixo do minimo (pode ter sido reposta entre o gatilho e o
 * processamento) e, se estiver, notifica todos os administradores ativos que
 * tenham o app instalado (expoPushToken) via push. Notificacao interna a
 * equipe usa push — nao WhatsApp — para nao esbarrar na janela de 24h / na
 * necessidade de template aprovado da Meta.
 */
export async function processarAlertaEstoque(pecaId: string): Promise<void> {
  const peca = await prisma.peca.findUnique({ where: { id: pecaId } });
  if (!peca || !peca.ativo) return;
  if (peca.estoqueAtual > peca.estoqueMinimo) return;

  const admins = await prisma.usuario.findMany({
    where: { papel: 'admin', ativo: true, expoPushToken: { not: null } },
    select: { id: true, expoPushToken: true },
  });

  const titulo = 'Estoque baixo';
  const corpo = `${peca.nome} (${peca.codigo}): ${peca.estoqueAtual} ${peca.unidade} em estoque (mínimo ${peca.estoqueMinimo}). Repor.`;

  for (const admin of admins) {
    if (!admin.expoPushToken) continue;
    await enqueueExpoPush({
      expoPushToken: admin.expoPushToken,
      titulo,
      corpo,
      data: { tipo: 'alerta_estoque', pecaId: peca.id },
    });
  }

  logger.info(
    {
      pecaId,
      estoqueAtual: peca.estoqueAtual,
      estoqueMinimo: peca.estoqueMinimo,
      adminsNotificados: admins.length,
    },
    'Alerta de estoque baixo processado',
  );
}

/** Cria o Worker BullMQ que consome a fila `alerta-estoque`. */
export function createAlertaEstoqueWorker(): Worker<AlertaEstoqueJobData> {
  const worker = new Worker<AlertaEstoqueJobData>(
    'alerta-estoque',
    (job) => processarAlertaEstoque(job.data.pecaId),
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila alerta-estoque');
  });

  return worker;
}
