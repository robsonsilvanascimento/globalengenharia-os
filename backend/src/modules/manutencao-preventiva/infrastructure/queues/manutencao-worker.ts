import { Queue, Worker } from 'bullmq';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { enqueueNotificacaoWhatsapp } from '../../../../shared/infra/queues/index';

export const alertaManutencaoQueue = new Queue('alerta-manutencao', {
  connection: redisConnection,
});

export function agendarAlertaManutencao(queue: Queue): void {
  queue.add(
    'verificar-manutencoes',
    {},
    {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'alerta-manutencao-cron',
    },
  );
}

export const manutencaoPreventivaWorker = new Worker(
  'alerta-manutencao',
  async () => {
    const agora = new Date();
    const limite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const inicioDoDia = new Date(agora.toISOString().slice(0, 10));

    const manutencoes = await prisma.manutencaoPreventiva.findMany({
      where: {
        proximaEm: { lte: limite },
        OR: [
          { notificadoEm: null },
          { notificadoEm: { lt: inicioDoDia } },
        ],
      },
      include: {
        componenteInstalado: {
          select: {
            nome: true,
            ordemServico: {
              select: {
                cliente: { select: { telefoneWhatsapp: true, nome: true } },
              },
            },
          },
        },
      },
    });

    if (manutencoes.length === 0) return;

    const admin = await prisma.usuario.findFirst({
      where: { papel: 'admin', ativo: true },
    });

    if (!admin) return;

    for (const m of manutencoes) {
      const componente = m.componenteInstalado;
      const cliente = componente.ordemServico.cliente;
      const diasRestantes = Math.ceil((m.proximaEm.getTime() - agora.getTime()) / 86400000);
      const mensagem = `🔧 Manutenção preventiva: ${componente.nome} do cliente ${cliente.nome} vence em ${diasRestantes} dias`;

      await enqueueNotificacaoWhatsapp({
        ordemServicoId: m.componenteInstaladoId,
        clienteId: admin.id,
        statusNovo: mensagem,
        templateNome: 'alerta-manutencao',
      });

      await prisma.manutencaoPreventiva.update({
        where: { id: m.id },
        data: { notificadoEm: new Date() },
      });
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
