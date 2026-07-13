import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { QUEUE_NAMES, type EntregaPdfOSJobData } from '../../../../shared/infra/queues';
import { gerarPdfOrdemServico } from '../../../../shared/infra/pdf/GerarPdfOrdemServicoService';
import { enviarEmailComAnexo } from '../../../../shared/infra/email/EmailService';
import { enviarDocumento } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import type { CategoriaServicoRepository } from '../../../categorias-servico/domain/CategoriaServicoRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';

export interface EntregaPdfWorkerDeps {
  ordemServicoRepository: OrdemServicoRepository;
  clienteRepository: ClienteRepository;
  categoriaServicoRepository: CategoriaServicoRepository;
}

const ENTREGA_PDF_WORKER_CONCURRENCY = 5;
const CAPTION_WHATSAPP = 'Aqui está a cópia da sua Ordem de Serviço \u{1F4C4}';

function buildFilename(numero: string): string {
  return `OS-${numero}.pdf`;
}

/**
 * Processa um job da fila `entrega-pdf-os`: busca a OS, o cliente e a
 * categoria, gera o PDF e entrega ao cliente via WhatsApp e, quando houver
 * e-mail cadastrado, tambem por e-mail.
 *
 * Falta de OS/cliente/categoria (inconsistencia de dados) relanca o erro para
 * que o BullMQ aplique retry. Ja falhas de envio em cada canal (WhatsApp ou
 * e-mail) sao tratadas de forma independente: uma nao impede a outra, e
 * nenhuma delas derruba o job — apenas fica registrada via log.
 */
export async function processarEntregaPdfOSJob(
  job: Job<EntregaPdfOSJobData>,
  deps: EntregaPdfWorkerDeps,
): Promise<void> {
  const { ordemServicoId } = job.data;
  const { ordemServicoRepository, clienteRepository, categoriaServicoRepository } = deps;

  const ordemServico = await ordemServicoRepository.findById(ordemServicoId);
  if (!ordemServico) {
    logger.error({ ordemServicoId }, 'Ordem de Servico nao encontrada para entrega de PDF');
    throw new Error(`OrdemServico ${ordemServicoId} nao encontrada para entrega de PDF`);
  }

  const [cliente, categoria] = await Promise.all([
    clienteRepository.findById(ordemServico.clienteId),
    categoriaServicoRepository.findById(ordemServico.categoriaServicoId),
  ]);

  if (!cliente) {
    logger.error(
      { ordemServicoId, clienteId: ordemServico.clienteId },
      'Cliente nao encontrado para entrega de PDF da OS',
    );
    throw new Error(`Cliente ${ordemServico.clienteId} nao encontrado para entrega de PDF da OS ${ordemServicoId}`);
  }

  if (!categoria) {
    logger.error(
      { ordemServicoId, categoriaServicoId: ordemServico.categoriaServicoId },
      'Categoria de servico nao encontrada para entrega de PDF da OS',
    );
    throw new Error(
      `CategoriaServico ${ordemServico.categoriaServicoId} nao encontrada para entrega de PDF da OS ${ordemServicoId}`,
    );
  }

  const pdf = await gerarPdfOrdemServico({
    numero: ordemServico.numero,
    criadoEm: ordemServico.criadoEm,
    clienteNome: cliente.nome,
    clienteTelefone: cliente.telefoneWhatsapp,
    clienteEmail: cliente.email ?? undefined,
    categoriaNome: categoria.nome,
    descricaoProblema: ordemServico.descricaoProblema,
    enderecoAtendimento: ordemServico.enderecoAtendimento,
    prioridade: ordemServico.prioridade,
    status: ordemServico.status,
  });

  const filename = buildFilename(ordemServico.numero);

  try {
    const resultadoWhatsapp = await enviarDocumento(
      cliente.telefoneWhatsapp,
      pdf,
      filename,
      'application/pdf',
      CAPTION_WHATSAPP,
    );

    if (!resultadoWhatsapp.sucesso) {
      logger.error(
        { ordemServicoId, clienteId: cliente.id, erro: resultadoWhatsapp.erro },
        'Falha ao entregar PDF da OS via WhatsApp',
      );
    } else {
      logger.info(
        { ordemServicoId, clienteId: cliente.id, messageId: resultadoWhatsapp.messageId },
        'PDF da OS entregue via WhatsApp com sucesso',
      );
    }
  } catch (err) {
    logger.error({ err, ordemServicoId, clienteId: cliente.id }, 'Erro inesperado ao entregar PDF da OS via WhatsApp');
  }

  if (cliente.email) {
    try {
      const resultadoEmail = await enviarEmailComAnexo(
        cliente.email,
        `Sua Ordem de Servico ${ordemServico.numero}`,
        `Ola, ${cliente.nome}! Segue em anexo a copia da sua Ordem de Servico ${ordemServico.numero}.`,
        { filename, content: pdf, contentType: 'application/pdf' },
      );

      if (!resultadoEmail.sucesso) {
        logger.error(
          { ordemServicoId, clienteId: cliente.id, erro: resultadoEmail.erro },
          'Falha ao entregar PDF da OS por e-mail',
        );
      } else {
        logger.info({ ordemServicoId, clienteId: cliente.id }, 'PDF da OS entregue por e-mail com sucesso');
      }
    } catch (err) {
      logger.error({ err, ordemServicoId, clienteId: cliente.id }, 'Erro inesperado ao entregar PDF da OS por e-mail');
    }
  } else {
    logger.info({ ordemServicoId, clienteId: cliente.id }, 'Cliente sem e-mail cadastrado - entrega apenas via WhatsApp');
  }
}

/** Cria o Worker BullMQ que consome a fila `entrega-pdf-os`. */
export function createEntregaPdfOSWorker(deps: EntregaPdfWorkerDeps): Worker<EntregaPdfOSJobData> {
  const worker = new Worker<EntregaPdfOSJobData>(
    QUEUE_NAMES.ENTREGA_PDF_OS,
    (job) => processarEntregaPdfOSJob(job, deps),
    {
      connection: redisConnection,
      concurrency: ENTREGA_PDF_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job da fila entrega-pdf-os falhou');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila entrega-pdf-os');
  });

  return worker;
}
