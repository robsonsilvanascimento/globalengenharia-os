import 'dotenv/config';
import { logger } from '../shared/infra/Logger';
import { eventBus } from '../shared/domain/EventBus';
import { prisma } from '../shared/infra/PrismaClient';
import { enqueueEntregaPdfOS } from '../shared/infra/queues';
import { PrismaClienteRepository } from '../modules/clientes/infrastructure/PrismaClienteRepository';
import { PrismaCategoriaServicoRepository } from '../modules/categorias-servico/infrastructure/PrismaCategoriaServicoRepository';
import { PrismaOrdemServicoRepository } from '../modules/ordens-servico/infrastructure/PrismaOrdemServicoRepository';
import { PrismaHistoricoStatusOSRepository } from '../modules/ordens-servico/infrastructure/PrismaHistoricoStatusOSRepository';
import { PrismaNumeroOSGenerator } from '../modules/ordens-servico/infrastructure/PrismaNumeroOSGenerator';
import { CriarOrdemServicoUseCase } from '../modules/ordens-servico/application/CriarOrdemServicoUseCase';
import { ListarOrdensServicoUseCase } from '../modules/ordens-servico/application/ListarOrdensServicoUseCase';
import { VerificarDisponibilidadeUseCase } from '../modules/ordens-servico/application/VerificarDisponibilidadeUseCase';
import { PrismaNotificacaoEnviadaRepository } from '../modules/notificacoes/infrastructure/PrismaNotificacaoEnviadaRepository';
import { createNotificacaoWorker } from '../modules/notificacoes/infrastructure/queues/notificacao-worker';
import { createNotificacaoTecnicoWorker } from '../modules/notificacoes/infrastructure/queues/notificacao-tecnico-worker';
import { PrismaUsuarioRepository } from '../modules/auth/infrastructure/PrismaUsuarioRepository';
import { createEntregaPdfOSWorker } from '../modules/entrega-documentos/infrastructure/queues/entrega-pdf-worker';
import { registrarEntregarPdfOSListener } from '../modules/entrega-documentos/application/EntregarPdfOSListener';
import { PrismaConversaWhatsappRepository } from '../modules/whatsapp/infrastructure/PrismaConversaWhatsappRepository';
import { PrismaMensagemWhatsappRepository } from '../modules/whatsapp/infrastructure/PrismaMensagemWhatsappRepository';
import { ConsultarStatusOSViaWhatsappUseCase } from '../modules/whatsapp/application/ConsultarStatusOSViaWhatsappUseCase';
import { ConsultarPagamentoViaWhatsappUseCase } from '../modules/whatsapp/application/ConsultarPagamentoViaWhatsappUseCase';
import { buscarPagamentoDaOS } from '../modules/pagamento/application/BuscarPagamentoDaOSUseCase';
import { ProcessarMensagemWhatsappUseCase } from '../modules/whatsapp/application/ProcessarMensagemWhatsappUseCase';
import { createWhatsappConversaWorker } from '../modules/whatsapp/infrastructure/queues/whatsapp-conversa-worker';
import { PrismaFaqEntryRepository } from '../modules/faq/infrastructure/PrismaFaqEntryRepository';
import { BuscarRespostaFaqUseCase } from '../modules/faq/application/BuscarRespostaFaqUseCase';
import { PrismaSolicitacaoAtendimentoRepository } from '../modules/atendimento-humano/infrastructure/PrismaSolicitacaoAtendimentoRepository';
import { CriarSolicitacaoAtendimentoUseCase } from '../modules/atendimento-humano/application/CriarSolicitacaoAtendimentoUseCase';
import { PrismaMidiaOrdemServicoRepository } from '../modules/midias/infrastructure/PrismaMidiaOrdemServicoRepository';
import { CriarMidiaOrdemServicoUseCase } from '../modules/midias/application/CriarMidiaOrdemServicoUseCase';
import { ArmazenamentoLocalService } from '../shared/infra/storage/ArmazenamentoLocalService';
import { createComissaoWorker } from '../modules/pagamento/infrastructure/queues/comissao-worker';
import { createPixWhatsappWorker } from '../modules/pagamento/infrastructure/queues/pix-whatsapp-worker';
import { createEntregaReciboWorker } from '../modules/pagamento/infrastructure/queues/entrega-recibo-worker';

/**
 * Processo separado, dedicado a consumir as filas do BullMQ (ex.: envio de
 * notificacoes de WhatsApp e processamento do fluxo guiado de atendimento).
 * Roda desacoplado do processo HTTP (`src/main/server.ts`) para nao competir
 * por recursos com as requisicoes da API. Novos workers devem ser
 * registrados aqui tambem, evitando duplicar o bootstrap.
 */
function start(): void {
  const notificacaoWorker = createNotificacaoWorker({
    clienteRepository: new PrismaClienteRepository(),
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
    notificacaoEnviadaRepository: new PrismaNotificacaoEnviadaRepository(),
  });

  notificacaoWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job da fila notificacoes-whatsapp concluido');
  });

  notificacaoWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job da fila notificacoes-whatsapp falhou');
  });

  const entregaPdfOSWorker = createEntregaPdfOSWorker({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
    clienteRepository: new PrismaClienteRepository(),
    categoriaServicoRepository: new PrismaCategoriaServicoRepository(),
  });

  entregaPdfOSWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job da fila entrega-pdf-os concluido');
  });

  entregaPdfOSWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job da fila entrega-pdf-os falhou');
  });

  const notificacaoTecnicoWorker = createNotificacaoTecnicoWorker({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
    clienteRepository: new PrismaClienteRepository(),
    usuarioRepository: new PrismaUsuarioRepository(),
    categoriaServicoRepository: new PrismaCategoriaServicoRepository(),
  });

  notificacaoTecnicoWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job da fila notificacao-tecnico concluido');
  });

  notificacaoTecnicoWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job da fila notificacao-tecnico falhou');
  });

  const comissaoWorker = createComissaoWorker();

  comissaoWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job da fila calcular-comissao concluido');
  });

  comissaoWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job da fila calcular-comissao falhou');
  });

  const pixWhatsappWorker = createPixWhatsappWorker({
    notificacaoEnviadaRepository: new PrismaNotificacaoEnviadaRepository(),
  });

  pixWhatsappWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job da fila pix-whatsapp concluido');
  });

  pixWhatsappWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job da fila pix-whatsapp falhou');
  });

  const entregaReciboWorker = createEntregaReciboWorker();

  entregaReciboWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job da fila entrega-recibo concluido');
  });

  entregaReciboWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job da fila entrega-recibo falhou');
  });

  // O EventBus e in-process (EventEmitter): cada processo Node tem sua propria
  // instancia do singleton `eventBus`. Por isso o listener de OSCriada precisa
  // ser registrado tambem AQUI (alem do processo HTTP em server.ts), para que
  // a OS criada pelo bot do WhatsApp (que roda neste processo de worker)
  // dispare a entrega automatica de PDF.
  registrarEntregarPdfOSListener(eventBus, enqueueEntregaPdfOS);

  const criarOrdemServicoUseCase = new CriarOrdemServicoUseCase({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
    historicoStatusOSRepository: new PrismaHistoricoStatusOSRepository(),
    numeroOSGenerator: new PrismaNumeroOSGenerator(),
    eventBus,
  });

  const listarOrdensServicoUseCase = new ListarOrdensServicoUseCase({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
  });

  const consultarStatusOSViaWhatsappUseCase = new ConsultarStatusOSViaWhatsappUseCase({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
    listarOrdensServicoUseCase,
  });

  const consultarPagamentoViaWhatsappUseCase = new ConsultarPagamentoViaWhatsappUseCase({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
    listarOrdensServicoUseCase,
    buscarPagamentoDaOS: (ordemServico) => buscarPagamentoDaOS(ordemServico, prisma),
  });

  const buscarRespostaFaqUseCase = new BuscarRespostaFaqUseCase({
    faqEntryRepository: new PrismaFaqEntryRepository(),
  });

  const criarSolicitacaoAtendimentoUseCase = new CriarSolicitacaoAtendimentoUseCase({
    solicitacaoAtendimentoRepository: new PrismaSolicitacaoAtendimentoRepository(),
  });

  const verificarDisponibilidadeUseCase = new VerificarDisponibilidadeUseCase({
    ordemServicoRepository: new PrismaOrdemServicoRepository(),
  });

  const processarMensagemWhatsappUseCase = new ProcessarMensagemWhatsappUseCase({
    conversaWhatsappRepository: new PrismaConversaWhatsappRepository(),
    clienteRepository: new PrismaClienteRepository(),
    categoriaServicoRepository: new PrismaCategoriaServicoRepository(),
    criarOrdemServicoUseCase,
    verificarDisponibilidadeUseCase,
    usuarioRepository: new PrismaUsuarioRepository(),
    consultarStatusOSViaWhatsappUseCase,
    consultarPagamentoViaWhatsappUseCase,
    buscarRespostaFaqUseCase,
    criarSolicitacaoAtendimentoUseCase,
  });

  const criarMidiaOrdemServicoUseCase = new CriarMidiaOrdemServicoUseCase({
    midiaOrdemServicoRepository: new PrismaMidiaOrdemServicoRepository(),
    armazenamentoArquivoService: new ArmazenamentoLocalService(),
  });

  createWhatsappConversaWorker({
    processarMensagemWhatsappUseCase,
    mensagemWhatsappRepository: new PrismaMensagemWhatsappRepository(),
    conversaWhatsappRepository: new PrismaConversaWhatsappRepository(),
    clienteRepository: new PrismaClienteRepository(),
    criarMidiaOrdemServicoUseCase,
  });

  logger.info(
    'Worker de filas iniciado (notificacoes-whatsapp, whatsapp-conversa, entrega-pdf-os, notificacao-tecnico, calcular-comissao, pix-whatsapp, entrega-recibo)',
  );
}

start();
