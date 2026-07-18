import { Queue, Worker } from 'bullmq';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { enviarTemplate } from '../../../whatsapp/infrastructure/MetaCloudApiClient';

/**
 * Nome do template de mensagem aprovado na Meta usado no lembrete. O lembrete
 * e enviado ~24h antes da visita, ou seja, fora da janela de 24h de conversa
 * — por isso precisa ser um template aprovado (nao texto livre). O template
 * deve ter 2 parametros no corpo: {{1}} = numero da OS, {{2}} = data/hora.
 */
const TEMPLATE_LEMBRETE = process.env.META_TEMPLATE_LEMBRETE_AGENDAMENTO ?? 'lembrete_agendamento';

const JANELA_MS = 24 * 60 * 60 * 1000;

export const lembreteAgendamentoQueue = new Queue('lembrete-agendamento', {
  connection: redisConnection,
});

/**
 * Agenda a verificacao periodica de lembretes (de hora em hora). Rodar de
 * hora em hora — e nao uma unica vez no dia — deixa o envio resiliente: se um
 * ciclo falhar, a OS ainda e pega no proximo, e o flag por OS
 * (`lembreteAgendamentoEnviadoEm`) garante que o lembrete saia so uma vez.
 */
export function agendarLembreteAgendamento(queue: Queue): Promise<unknown> {
  return queue.add(
    'verificar-agendamentos',
    {},
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'lembrete-agendamento-cron',
    },
  );
}

function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Envia lembrete de agendamento para as OS cuja visita esta marcada para as
 * proximas 24h, ainda nao concluidas/canceladas e que ainda nao receberam o
 * lembrete. Marca `lembreteAgendamentoEnviadoEm` so apos o envio bem-sucedido;
 * se o envio falhar, a OS nao e marcada e sera tentada de novo no proximo
 * ciclo (o BullMQ + o cron cuidam da nova tentativa).
 */
export async function processarLembretesAgendamento(): Promise<void> {
  const agora = new Date();
  const limite = new Date(agora.getTime() + JANELA_MS);

  const ordens = await prisma.ordemServico.findMany({
    where: {
      dataAgendada: { gt: agora, lte: limite },
      lembreteAgendamentoEnviadoEm: null,
      status: { notIn: ['concluida', 'cancelada'] },
    },
    select: {
      id: true,
      numero: true,
      dataAgendada: true,
      cliente: { select: { telefoneWhatsapp: true, nome: true } },
    },
  });

  if (ordens.length === 0) return;

  for (const os of ordens) {
    if (!os.dataAgendada) continue;

    const resultado = await enviarTemplate(os.cliente.telefoneWhatsapp, TEMPLATE_LEMBRETE, [
      os.numero,
      formatarDataHora(os.dataAgendada),
    ]);

    if (!resultado.sucesso) {
      logger.error(
        { ordemServicoId: os.id, erro: resultado.erro },
        'Falha ao enviar lembrete de agendamento (sera tentado no proximo ciclo)',
      );
      continue;
    }

    await prisma.ordemServico.update({
      where: { id: os.id },
      data: { lembreteAgendamentoEnviadoEm: new Date() },
    });

    logger.info(
      { ordemServicoId: os.id, numero: os.numero, messageId: resultado.messageId },
      'Lembrete de agendamento enviado ao cliente',
    );
  }
}

export const lembreteAgendamentoWorker = new Worker(
  'lembrete-agendamento',
  () => processarLembretesAgendamento(),
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
