import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { QUEUE_NAMES, type NotificacaoWhatsappJobData } from '../../../../shared/infra/queues';
import { enviarTemplate } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { NotificacaoEnviadaRepository } from '../../domain/NotificacaoEnviadaRepository';

export interface NotificacaoWorkerDeps {
  clienteRepository: ClienteRepository;
  ordemServicoRepository: OrdemServicoRepository;
  notificacaoEnviadaRepository: NotificacaoEnviadaRepository;
}

const NOTIFICACAO_WORKER_CONCURRENCY = 5;

function buildTipoEvento(statusNovo: string): string {
  return `os_status_alterado:${statusNovo}`;
}

/**
 * Processa um job da fila `notificacoes-whatsapp`: busca o telefone do
 * cliente e o numero da OS, envia o template via Meta Cloud API e grava o
 * resultado em `NotificacaoEnviada`.
 *
 * Em caso de falha (cliente inexistente ou erro no envio), grava o registro
 * com `statusEnvio: 'falhou'` e relanca o erro para que o BullMQ trate o job
 * como falho e aplique o retry/backoff configurado na fila — o worker em si
 * nao e derrubado por isso (o `Worker` do BullMQ captura erros do processor
 * por job).
 */
export async function processarNotificacaoJob(
  job: Job<NotificacaoWhatsappJobData>,
  deps: NotificacaoWorkerDeps,
): Promise<void> {
  const { ordemServicoId, clienteId, statusNovo, templateNome } = job.data;
  const { clienteRepository, ordemServicoRepository, notificacaoEnviadaRepository } = deps;
  const tipoEvento = buildTipoEvento(statusNovo);
  const tentativas = job.attemptsMade + 1;

  const [cliente, ordemServico] = await Promise.all([
    clienteRepository.findById(clienteId),
    ordemServicoRepository.findById(ordemServicoId),
  ]);

  if (!cliente) {
    await notificacaoEnviadaRepository.create({
      ordemServicoId,
      clienteId,
      tipoEvento,
      templateUsado: templateNome,
      statusEnvio: 'falhou',
      tentativas,
    });
    logger.error({ ordemServicoId, clienteId }, 'Cliente nao encontrado para envio de notificacao de WhatsApp');
    throw new Error(`Cliente ${clienteId} nao encontrado para notificacao da OS ${ordemServicoId}`);
  }

  const numeroOS = ordemServico?.numero ?? ordemServicoId;
  const resultado = await enviarTemplate(cliente.telefoneWhatsapp, templateNome, [numeroOS, statusNovo]);

  if (!resultado.sucesso) {
    await notificacaoEnviadaRepository.create({
      ordemServicoId,
      clienteId,
      tipoEvento,
      templateUsado: templateNome,
      statusEnvio: 'falhou',
      tentativas,
    });
    logger.error(
      { ordemServicoId, clienteId, templateNome, erro: resultado.erro },
      'Falha ao enviar notificacao de WhatsApp',
    );
    throw new Error(resultado.erro);
  }

  await notificacaoEnviadaRepository.create({
    ordemServicoId,
    clienteId,
    tipoEvento,
    templateUsado: templateNome,
    statusEnvio: 'enviada',
    tentativas,
    enviadoEm: new Date(),
  });
  logger.info(
    { ordemServicoId, clienteId, templateNome, messageId: resultado.messageId },
    'Notificacao de WhatsApp enviada com sucesso',
  );
}

/** Cria o Worker BullMQ que consome a fila `notificacoes-whatsapp`. */
export function createNotificacaoWorker(deps: NotificacaoWorkerDeps): Worker<NotificacaoWhatsappJobData> {
  return new Worker<NotificacaoWhatsappJobData>(
    QUEUE_NAMES.NOTIFICACOES_WHATSAPP,
    (job) => processarNotificacaoJob(job, deps),
    {
      connection: redisConnection,
      concurrency: NOTIFICACAO_WORKER_CONCURRENCY,
    },
  );
}
