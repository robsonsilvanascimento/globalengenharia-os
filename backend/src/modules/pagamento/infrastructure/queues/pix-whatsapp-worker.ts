import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { QUEUE_NAMES, type PixWhatsappJobData } from '../../../../shared/infra/queues';
import { gerarOuReutilizarPix } from '../../application/GerarOuReutilizarPixUseCase';
import { enviarTemplate } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import type { NotificacaoEnviadaRepository } from '../../../notificacoes/domain/NotificacaoEnviadaRepository';

export interface PixWhatsappWorkerDeps {
  notificacaoEnviadaRepository: NotificacaoEnviadaRepository;
}

const PIX_WHATSAPP_WORKER_CONCURRENCY = 5;
const TIPO_EVENTO_PIX_COBRANCA = 'pix_cobranca';

function templateNomePixCobranca(): string {
  return process.env.WHATSAPP_TEMPLATE_PIX_COBRANCA ?? 'pix_cobranca';
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Processa um job da fila `pix-whatsapp`: busca a OS (ja concluida) e o
 * cliente, gera o Pix via Mercado Pago (reaproveitando `gerarPixOrdemServico`,
 * o mesmo servico usado pela geracao manual em `GerarPixUseCase`) quando
 * ainda nao existe um Pix pendente para essa OS, e envia o codigo ao cliente
 * via WhatsApp usando um template aprovado (obrigatorio pela Meta Cloud API
 * fora da janela de 24h de conversa).
 *
 * Nao gera Pix quando a OS nao tem `valorCobrado` definido (o admin precisa
 * informar o valor e gerar manualmente) nem quando ja esta paga. Reaproveita
 * um Pix pendente ja existente em vez de gerar um novo em cada retry do job
 * (evita cobrancas duplicadas no Mercado Pago).
 */
export async function processarPixWhatsappJob(
  job: Job<PixWhatsappJobData>,
  deps: PixWhatsappWorkerDeps,
): Promise<void> {
  const { ordemServicoId } = job.data;
  const { notificacaoEnviadaRepository } = deps;

  const ordemServico = await prisma.ordemServico.findUnique({
    where: { id: ordemServicoId },
    include: { cliente: { select: { id: true, nome: true, email: true, telefoneWhatsapp: true } } },
  });

  if (!ordemServico) {
    logger.error({ ordemServicoId }, 'OS nao encontrada para geracao de Pix apos conclusao');
    throw new Error(`OrdemServico ${ordemServicoId} nao encontrada para geracao de Pix`);
  }

  if (ordemServico.statusPagamento === 'pago') {
    logger.info({ ordemServicoId }, 'OS ja esta paga - Pix nao gerado nem enviado');
    return;
  }

  const valorCobrado = ordemServico.valorCobrado ? Number(ordemServico.valorCobrado) : 0;

  if (!valorCobrado) {
    logger.warn(
      { ordemServicoId },
      'OS concluida sem valor cobrado definido - Pix nao gerado automaticamente. Informe o valor e gere manualmente.',
    );
    return;
  }

  const pagamentoOS = await gerarOuReutilizarPix(
    {
      ordemServicoId,
      valorCobrado,
      clienteNome: ordemServico.cliente.nome,
      clienteEmail: ordemServico.cliente.email ?? undefined,
    },
    prisma,
  );

  const templateNome = templateNomePixCobranca();
  const tentativas = job.attemptsMade + 1;

  const resultado = await enviarTemplate(ordemServico.cliente.telefoneWhatsapp, templateNome, [
    ordemServico.numero,
    formatarValor(valorCobrado),
    pagamentoOS.pixCopiaECola ?? '',
  ]);

  if (!resultado.sucesso) {
    await notificacaoEnviadaRepository.create({
      ordemServicoId,
      clienteId: ordemServico.cliente.id,
      tipoEvento: TIPO_EVENTO_PIX_COBRANCA,
      templateUsado: templateNome,
      statusEnvio: 'falhou',
      tentativas,
    });
    logger.error(
      { ordemServicoId, erro: resultado.erro },
      'Falha ao enviar Pix via WhatsApp apos conclusao da OS',
    );
    throw new Error(resultado.erro);
  }

  await notificacaoEnviadaRepository.create({
    ordemServicoId,
    clienteId: ordemServico.cliente.id,
    tipoEvento: TIPO_EVENTO_PIX_COBRANCA,
    templateUsado: templateNome,
    statusEnvio: 'enviada',
    tentativas,
    enviadoEm: new Date(),
  });

  logger.info(
    { ordemServicoId, messageId: resultado.messageId },
    'Pix da OS concluida enviado ao cliente via WhatsApp com sucesso',
  );
}

/** Cria o Worker BullMQ que consome a fila `pix-whatsapp`. */
export function createPixWhatsappWorker(deps: PixWhatsappWorkerDeps): Worker<PixWhatsappJobData> {
  const worker = new Worker<PixWhatsappJobData>(
    QUEUE_NAMES.PIX_WHATSAPP,
    (job) => processarPixWhatsappJob(job, deps),
    {
      connection: redisConnection,
      concurrency: PIX_WHATSAPP_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job da fila pix-whatsapp falhou');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Erro no worker da fila pix-whatsapp');
  });

  return worker;
}
