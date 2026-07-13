import { Queue, Worker } from 'bullmq';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { enqueueNotificacaoWhatsapp } from '../../../../shared/infra/queues/index';
import { Prisma } from '@prisma/client';

interface InadimplenteRow {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_cobrado: unknown;
  atualizado_em: Date;
}

export const alertaInadimplenciaQueue = new Queue('alerta-inadimplencia', {
  connection: redisConnection,
});

export function agendarAlertaInadimplencia(queue: Queue): void {
  queue.add(
    'verificar-inadimplentes',
    {},
    {
      repeat: { pattern: '0 9 * * *' },
      jobId: 'alerta-inadimplencia-cron',
    },
  );
}

export const inadimplenciaWorker = new Worker(
  'alerta-inadimplencia',
  async () => {
    const tresDiasAtras = new Date(Date.now() - 3 * 86400000);

    const inadimplentes = await prisma.$queryRaw<InadimplenteRow[]>(Prisma.sql`
      SELECT
        os.id,
        os.numero,
        cl.nome AS cliente_nome,
        os.valor_cobrado,
        os.atualizado_em
      FROM "OrdemServico" os
      JOIN "Cliente" cl ON cl.id = os.cliente_id
      WHERE os.status = 'concluida'
        AND os.status_pagamento = 'pendente'
        AND os.atualizado_em < ${tresDiasAtras}
    `);

    if (inadimplentes.length === 0) return;

    const admin = await prisma.usuario.findFirst({
      where: { papel: 'admin', ativo: true },
    });

    if (!admin) return;

    for (const os of inadimplentes) {
      const diasEmAtraso = Math.floor((Date.now() - os.atualizado_em.getTime()) / 86400000);
      const valorCobrado = Number(os.valor_cobrado ?? 0).toFixed(2);
      const mensagem = `⚠️ OS ${os.numero} - ${os.cliente_nome} está pendente de pagamento há ${diasEmAtraso} dias. Valor: R$ ${valorCobrado}`;

      await enqueueNotificacaoWhatsapp({
        ordemServicoId: os.id,
        clienteId: admin.id,
        statusNovo: mensagem,
        templateNome: 'alerta-inadimplencia',
      });
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
