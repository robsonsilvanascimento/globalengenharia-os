import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { QUEUE_NAMES, type NotificacaoTecnicoJobData } from '../../../../shared/infra/queues';
import { enviarTexto } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import type { OrdemServico } from '../../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { CategoriaServicoRepository } from '../../../categorias-servico/domain/CategoriaServicoRepository';
import type { UsuarioRepository } from '../../../auth/domain/UsuarioRepository';

export interface NotificacaoTecnicoWorkerDeps {
  ordemServicoRepository: OrdemServicoRepository;
  clienteRepository: ClienteRepository;
  usuarioRepository: UsuarioRepository;
  categoriaServicoRepository: CategoriaServicoRepository;
}

const NOTIFICACAO_TECNICO_WORKER_CONCURRENCY = 5;

function formatarDataAgendada(dataAgendada: Date | null | undefined): string {
  if (!dataAgendada) {
    return 'A combinar';
  }

  return dataAgendada.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function montarMensagemTecnico(numero: string, clienteNome: string, dataAgendada: Date | null | undefined): string {
  return `Você foi atribuído à OS ${numero}.\nCliente: ${clienteNome}.\nData/hora do atendimento: ${formatarDataAgendada(dataAgendada)}.`;
}

/** Formata data+hora de forma natural para a mensagem do ajudante (ex.: "no dia 15/07/2026 às 14:30"). */
function formatarDataHoraAjudante(dataAgendada: Date | null | undefined): string {
  if (!dataAgendada) {
    return 'em data a combinar';
  }

  const data = dataAgendada.toLocaleDateString('pt-BR');
  const hora = dataAgendada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `no dia ${data} às ${hora}`;
}

function montarMensagemAjudante(
  tecnicoNome: string,
  categoriaNome: string,
  dataAgendada: Date | null | undefined,
): string {
  return `Você vai ajudar o técnico ${tecnicoNome} na atividade ${categoriaNome} ${formatarDataHoraAjudante(dataAgendada)}.`;
}

/** Notifica o tecnico atribuido a OS. Nao relanca erros - apenas loga. */
async function notificarTecnico(params: {
  ordemServico: OrdemServico;
  ordemServicoId: string;
  tecnicoId: string;
  clienteRepository: ClienteRepository;
  usuarioRepository: UsuarioRepository;
}): Promise<void> {
  const { ordemServico, ordemServicoId, tecnicoId, clienteRepository, usuarioRepository } = params;

  try {
    const [cliente, tecnico] = await Promise.all([
      clienteRepository.findById(ordemServico.clienteId),
      usuarioRepository.findById(tecnicoId),
    ]);

    if (!cliente) {
      logger.error(
        { ordemServicoId, clienteId: ordemServico.clienteId },
        'Cliente nao encontrado para notificacao de tecnico',
      );
      return;
    }

    if (!tecnico) {
      logger.error({ ordemServicoId, tecnicoId }, 'Tecnico nao encontrado para notificacao de atribuicao');
      return;
    }

    if (!tecnico.telefone) {
      logger.warn(
        { ordemServicoId, tecnicoId },
        'Tecnico sem telefone cadastrado - notificacao de atribuicao nao enviada',
      );
      return;
    }

    const mensagem = montarMensagemTecnico(ordemServico.numero, cliente.nome, ordemServico.dataAgendada);
    const resultado = await enviarTexto(tecnico.telefone, mensagem);

    if (!resultado.sucesso) {
      logger.error(
        { ordemServicoId, tecnicoId, erro: resultado.erro },
        'Falha ao enviar notificacao de atribuicao ao tecnico via WhatsApp',
      );
      return;
    }

    logger.info(
      { ordemServicoId, tecnicoId, messageId: resultado.messageId },
      'Notificacao de atribuicao enviada ao tecnico com sucesso',
    );
  } catch (err) {
    logger.error({ err, ordemServicoId, tecnicoId }, 'Erro inesperado ao notificar tecnico sobre atribuicao');
  }
}

/**
 * Notifica o ajudante atribuido a OS (quando houver). Busca o nome do
 * tecnico (para compor a mensagem) e a categoria da OS (para descrever a
 * atividade). Nao relanca erros - apenas loga, e nao interfere na
 * notificacao do tecnico.
 */
async function notificarAjudante(params: {
  ordemServico: OrdemServico;
  ordemServicoId: string;
  tecnicoId: string;
  ajudanteId: string;
  usuarioRepository: UsuarioRepository;
  categoriaServicoRepository: CategoriaServicoRepository;
}): Promise<void> {
  const { ordemServico, ordemServicoId, tecnicoId, ajudanteId, usuarioRepository, categoriaServicoRepository } =
    params;

  try {
    const [tecnico, ajudante, categoria] = await Promise.all([
      usuarioRepository.findById(tecnicoId),
      usuarioRepository.findById(ajudanteId),
      categoriaServicoRepository.findById(ordemServico.categoriaServicoId),
    ]);

    if (!tecnico) {
      logger.error(
        { ordemServicoId, tecnicoId, ajudanteId },
        'Tecnico nao encontrado para notificacao de atribuicao do ajudante',
      );
      return;
    }

    if (!ajudante) {
      logger.error({ ordemServicoId, ajudanteId }, 'Ajudante nao encontrado para notificacao de atribuicao');
      return;
    }

    if (!categoria) {
      logger.error(
        { ordemServicoId, categoriaServicoId: ordemServico.categoriaServicoId },
        'Categoria de servico nao encontrada para notificacao do ajudante',
      );
      return;
    }

    if (!ajudante.telefone) {
      logger.warn(
        { ordemServicoId, ajudanteId },
        'Ajudante sem telefone cadastrado - notificacao de atribuicao nao enviada',
      );
      return;
    }

    const mensagem = montarMensagemAjudante(tecnico.nome, categoria.nome, ordemServico.dataAgendada);
    const resultado = await enviarTexto(ajudante.telefone, mensagem);

    if (!resultado.sucesso) {
      logger.error(
        { ordemServicoId, ajudanteId, erro: resultado.erro },
        'Falha ao enviar notificacao de atribuicao ao ajudante via WhatsApp',
      );
      return;
    }

    logger.info(
      { ordemServicoId, ajudanteId, messageId: resultado.messageId },
      'Notificacao de atribuicao enviada ao ajudante com sucesso',
    );
  } catch (err) {
    logger.error({ err, ordemServicoId, ajudanteId }, 'Erro inesperado ao notificar ajudante sobre atribuicao');
  }
}

/**
 * Processa um job da fila `notificacao-tecnico`: busca a OS e notifica o
 * tecnico via WhatsApp; quando o job traz `ajudanteId`, notifica tambem o
 * ajudante em paralelo. Os dois envios sao independentes entre si - uma
 * falha (dados ausentes ou erro no envio) em um deles nao impede o outro.
 *
 * Se o tecnico/ajudante nao tiver telefone cadastrado, apenas loga um aviso
 * (nao e um erro, so nao ha como notificar). Falhas de envio/erros
 * inesperados sao capturados e logados sem relancar, para nao derrubar o
 * worker - o retry nativo do BullMQ so se aplica a erros relancados, e aqui
 * preferimos nao reenfileirar reenvios de notificacao que ja falharam por
 * falta de dados.
 */
export async function processarNotificacaoTecnicoJob(
  job: Job<NotificacaoTecnicoJobData>,
  deps: NotificacaoTecnicoWorkerDeps,
): Promise<void> {
  const { ordemServicoId, tecnicoId, ajudanteId } = job.data;
  const { ordemServicoRepository, clienteRepository, usuarioRepository, categoriaServicoRepository } = deps;

  try {
    const ordemServico = await ordemServicoRepository.findById(ordemServicoId);
    if (!ordemServico) {
      logger.error({ ordemServicoId }, 'Ordem de Servico nao encontrada para notificacao de tecnico');
      return;
    }

    await Promise.allSettled([
      notificarTecnico({ ordemServico, ordemServicoId, tecnicoId, clienteRepository, usuarioRepository }),
      ajudanteId
        ? notificarAjudante({
            ordemServico,
            ordemServicoId,
            tecnicoId,
            ajudanteId,
            usuarioRepository,
            categoriaServicoRepository,
          })
        : Promise.resolve(),
    ]);
  } catch (err) {
    logger.error({ err, ordemServicoId, tecnicoId }, 'Erro inesperado ao notificar tecnico sobre atribuicao');
  }
}

/** Cria o Worker BullMQ que consome a fila `notificacao-tecnico`. */
export function createNotificacaoTecnicoWorker(
  deps: NotificacaoTecnicoWorkerDeps,
): Worker<NotificacaoTecnicoJobData> {
  const worker = new Worker<NotificacaoTecnicoJobData>(
    QUEUE_NAMES.NOTIFICACAO_TECNICO,
    (job) => processarNotificacaoTecnicoJob(job, deps),
    {
      connection: redisConnection,
      concurrency: NOTIFICACAO_TECNICO_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job da fila notificacao-tecnico falhou');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila notificacao-tecnico');
  });

  return worker;
}
