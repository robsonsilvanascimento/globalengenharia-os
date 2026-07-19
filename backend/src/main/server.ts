import 'dotenv/config';
import Fastify from 'fastify';
import { logger } from '../shared/infra/Logger';
import { errorHandler } from '../shared/http/middlewares/error-handler';
import { registerRateLimit } from '../shared/http/middlewares/rate-limit';
import { registerAuthRoutes } from '../modules/auth/infrastructure/http/routes';
import { registerUsuariosRoutes } from '../modules/auth/infrastructure/http/usuarios-routes';
import { registerCategoriasServicoRoutes } from '../modules/categorias-servico/infrastructure/http/routes';
import { registerFaqRoutes } from '../modules/faq/infrastructure/http/routes';
import { registerClientesRoutes } from '../modules/clientes/infrastructure/http/routes';
import { registerOrdensServicoRoutes } from '../modules/ordens-servico/infrastructure/http/routes';
import { registerAtendimentoHumanoRoutes } from '../modules/atendimento-humano/infrastructure/http/routes';
import { registerWhatsappWebhookRoutes } from '../modules/whatsapp/infrastructure/http/webhook-routes';
import { registerMidiasRoutes } from '../modules/midias/infrastructure/http/routes';
import { registerEstimativaCustoRoutes } from '../modules/estimativa-custo/infrastructure/http/routes';
import { registerRastreabilidadeRoutes } from '../modules/rastreabilidade/infrastructure/http/routes';
import { registerAuditoriaRoutes } from '../modules/auditoria/infrastructure/http/routes';
import { registerRelatorioTecnicoRoutes } from '../modules/relatorio-tecnico/infrastructure/http/routes';
import { registerPendenciasRoutes } from '../modules/pendencias/infrastructure/http/routes';
import { registerChecklistRoutes } from '../modules/checklist/infrastructure/http/routes';
import { registerFotosServicoRoutes } from '../modules/fotos-servico/infrastructure/http/routes';
import { registerOrcamentoRoutes } from '../modules/orcamento/infrastructure/http/routes';
import { PrismaOrcamentoOSRepository } from '../modules/orcamento/infrastructure/PrismaOrcamentoOSRepository';
import { registerLaudoTecnicoRoutes } from '../modules/laudo-tecnico/infrastructure/http/routes';
import { PrismaTrechoNormativoRepository } from '../modules/laudo-tecnico/infrastructure/PrismaTrechoNormativoRepository';
import { PrismaLaudoRepository } from '../modules/laudo-tecnico/infrastructure/PrismaLaudoRepository';
import { PrismaLaudoFotoRepository } from '../modules/laudo-tecnico/infrastructure/PrismaLaudoFotoRepository';
import { seedTrechosNormativos } from '../modules/laudo-tecnico/infrastructure/seed/seed-trechos-normativos';
import { registerSlaRoutes } from '../modules/sla/infrastructure/http/routes';
import { slaVerificacaoQueue } from '../modules/sla/infrastructure/queues/sla-queue';
import { agendarVerificacaoSla } from '../modules/sla/infrastructure/queues/agendar-sla';
import '../modules/sla/infrastructure/queues/sla-worker';
import '../modules/notificacoes/infrastructure/queues/expo-push-worker';
import { registerAnalyticsRoutes } from '../modules/analytics/infrastructure/http/routes';
import { registerRelatorioGerencialRoutes } from '../modules/relatorio/infrastructure/http/relatorio-gerencial-routes';
import { relatorioGerencialQueue } from '../modules/relatorio/infrastructure/queues/relatorio-queue';
import '../modules/relatorio/infrastructure/queues/relatorio-worker';
import { registerAlertasGarantiaRoutes } from '../modules/garantia/infrastructure/http/routes';
import { registerAssinaturaOSRoutes } from '../modules/assinatura-os/infrastructure/http/routes';
import { alertaGarantiaQueue } from '../modules/garantia/infrastructure/queues/garantia-queue';
import { agendarAlertaGarantia } from '../modules/garantia/infrastructure/queues/agendar-garantia';
import { garantiaWorker } from '../modules/garantia/infrastructure/queues/garantia-worker';
import { registrarAuditoriaMiddleware } from '../shared/infra/auditoria/auditoriaMiddleware';
import { registrarNotificarMudancaStatusListener } from '../modules/notificacoes/application/NotificarMudancaStatusListener';
import { registrarNotificarTecnicoAtribuidoListener } from '../modules/notificacoes/application/NotificarTecnicoAtribuidoListener';
import { GoogleCalendarService } from '../modules/google-calendar/infrastructure/GoogleCalendarService';
import { registrarSincronizarCalendarioListener } from '../modules/google-calendar/application/SincronizarCalendarioListener';
import { registrarEntregarPdfOSListener } from '../modules/entrega-documentos/application/EntregarPdfOSListener';
import {
  enqueueNotificacaoWhatsapp,
  enqueueEntregaPdfOS,
  enqueueNotificacaoTecnico,
  enqueuePixWhatsapp,
} from '../shared/infra/queues';
import { enqueueExpoPush } from '../modules/notificacoes/infrastructure/queues/expo-push-queue';
import { registerPortalClienteRoutes } from '../modules/portal-cliente/infrastructure/http/routes';
import { registerNpsRoutes } from '../modules/nps/infrastructure/http/routes';
import { enqueueNpsPesquisa } from '../modules/nps/infrastructure/queues/nps-queue';
import '../modules/nps/infrastructure/queues/nps-worker';
import { registrarEnfileirarNpsListener } from '../modules/nps/application/EnfileirarNpsListener';
import { registerWebhookMercadoPagoRoutes } from '../modules/pagamento/infrastructure/http/webhook-routes';
import { registerPagamentoRoutes } from '../modules/pagamento/infrastructure/http/routes';
import { registrarGerarPixAoConcluirOSListener } from '../modules/pagamento/application/GerarPixAoConcluirOSListener';
import { registerFinanceiroRoutes } from '../modules/financeiro/infrastructure/http/routes';
import { alertaInadimplenciaQueue, agendarAlertaInadimplencia } from '../modules/financeiro/infrastructure/queues/inadimplencia-worker';
import { registerFinanceiroRecorrenteRoutes } from '../modules/financeiro-recorrente/infrastructure/http/routes';
import { PrismaContaReceberRepository } from '../modules/financeiro-recorrente/infrastructure/PrismaContaReceberRepository';
import { PrismaContratoRecorrenteRepository } from '../modules/financeiro-recorrente/infrastructure/PrismaContratoRecorrenteRepository';
import {
  agendarFaturamentoRecorrente,
  faturamentoRecorrenteQueue,
} from '../modules/financeiro-recorrente/infrastructure/queues/faturamento-recorrente-worker';
import { registerRastreioTecnicoRoutes } from '../modules/rastreio-tecnico/infrastructure/http/routes';
import { PrismaRastreioTecnicoRepository } from '../modules/rastreio-tecnico/infrastructure/PrismaRastreioTecnicoRepository';
import { PrismaOrdemAgendadaRepository } from '../modules/rastreio-tecnico/infrastructure/PrismaOrdemAgendadaRepository';
import { PrismaBuscarOSParaRastreio } from '../modules/rastreio-tecnico/infrastructure/PrismaBuscarOSParaRastreio';
import { registerEstoqueRoutes } from '../modules/estoque/infrastructure/http/routes';
import { registerConsumoPecasRoutes } from '../modules/estoque/infrastructure/http/consumo-routes';
import { registerManutencaoPreventivaRoutes } from '../modules/manutencao-preventiva/infrastructure/http/routes';
import { agendarAlertaManutencao } from '../modules/manutencao-preventiva/infrastructure/queues/manutencao-worker';
import {
  agendarLembreteAgendamento,
  lembreteAgendamentoQueue,
  lembreteAgendamentoWorker,
} from '../modules/ordens-servico/infrastructure/queues/lembrete-agendamento-worker';
import { registerApiPublicaRoutes } from '../modules/api-publica/infrastructure/http/public-api-routes';
import { registerRelatoriosExcelRoutes } from '../modules/relatorios-excel/infrastructure/http/routes';
import { Queue } from 'bullmq';
import { prisma } from '../shared/infra/PrismaClient';
import { redisConnection } from '../shared/infra/RedisConnection';
import { container } from './di-container';

const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? '0.0.0.0';

async function buildServer() {
  const app = Fastify({
    logger: false, // usamos o logger pino compartilhado (shared/infra/Logger) em vez do interno
  });

  app.setErrorHandler(errorHandler);

  await registerRateLimit(app);

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  registerAuthRoutes(app, container.auth);
  registerUsuariosRoutes(app, container.auth);
  registerCategoriasServicoRoutes(app, container.categoriasServico);
  registerFaqRoutes(app, container.faq);
  registerClientesRoutes(app, {
    ...container.clientes,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
    categoriaServicoRepository: container.categoriasServico.categoriaServicoRepository,
  });
  const orcamentoRepository = new PrismaOrcamentoOSRepository(container.prisma);

  registerOrdensServicoRoutes(app, {
    ...container.ordensServico,
    eventBus: container.eventBus,
    clienteRepository: container.clientes.clienteRepository,
    usuarioRepository: container.auth.usuarioRepository,
    checklistRepository: container.checklist.checklistRepository,
    orcamentoAprovado: async (ordemServicoId) => {
      const orcamento = await orcamentoRepository.buscarPorOrdemServico(ordemServicoId);
      return orcamento?.status === 'aprovado';
    },
  });
  registerAtendimentoHumanoRoutes(app, {
    ...container.atendimentoHumano,
    clienteRepository: container.clientes.clienteRepository,
    criarFaqEntry: container.faq.faqEntryRepository,
  });
  registerWhatsappWebhookRoutes(app);
  registerMidiasRoutes(app, {
    ...container.midias,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
  });
  registerEstimativaCustoRoutes(app, {
    ...container.estimativaCusto,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
    usuarioRepository: container.auth.usuarioRepository,
  });
  registerRastreabilidadeRoutes(app, {
    ...container.rastreabilidade,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
  });

  registerPendenciasRoutes(app, {
    pendenciaRepository: container.pendencias.pendenciaOSRepository,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
  });
  registerChecklistRoutes(app, {
    checklistRepository: container.checklist.checklistRepository,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
  });
  registerFotosServicoRoutes(app, {
    fotoServicoRepository: container.fotosServico.fotoServicoRepository,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
  });

  registerOrcamentoRoutes(app, {
    orcamentoRepository,
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
    aoAprovarOrcamento: async (ordemServicoId) => {
      // Avisa a equipe (admins/atendentes com app) que o cliente aprovou.
      const os = await container.ordensServico.ordemServicoRepository.findById(ordemServicoId);
      const equipe = await container.prisma.usuario.findMany({
        where: { papel: { in: ['admin', 'atendente'] }, ativo: true, expoPushToken: { not: null } },
        select: { expoPushToken: true },
      });
      for (const membro of equipe) {
        if (!membro.expoPushToken) continue;
        await enqueueExpoPush({
          expoPushToken: membro.expoPushToken,
          titulo: 'Orçamento aprovado',
          corpo: `O cliente aprovou o orçamento da OS ${os?.numero ?? ordemServicoId}.`,
          data: { tipo: 'orcamento_aprovado', ordemServicoId },
        });
      }
    },
  });

  const trechoNormativoRepository = new PrismaTrechoNormativoRepository(container.prisma);
  registerLaudoTecnicoRoutes(app, {
    trechoNormativoRepository,
    laudoRepository: new PrismaLaudoRepository(container.prisma),
    laudoFotoRepository: new PrismaLaudoFotoRepository(container.prisma),
    armazenamentoArquivoService: container.midias.armazenamentoArquivoService,
  });
  await seedTrechosNormativos(trechoNormativoRepository);

  registerAssinaturaOSRoutes(app, { prisma: container.prisma });
  registerAnalyticsRoutes(app, { prisma: container.prisma });
  registerRelatorioGerencialRoutes(app, { prisma: container.prisma, relatorioQueue: relatorioGerencialQueue });
  registerAlertasGarantiaRoutes(app, { prisma: container.prisma });
  await agendarAlertaGarantia(alertaGarantiaQueue);
  void garantiaWorker;

  registerSlaRoutes(app, { prisma: container.prisma });
  await agendarVerificacaoSla(slaVerificacaoQueue);

  registrarAuditoriaMiddleware(app, container.auditoria.auditLogRepository);
  registerAuditoriaRoutes(app, container.auditoria);

  registerRelatorioTecnicoRoutes(app, {
    ordemServicoRepository: container.ordensServico.ordemServicoRepository,
    componenteInstaladoRepository: container.rastreabilidade.componenteInstaladoRepository,
    documentoOSRepository: container.rastreabilidade.documentoOSRepository,
    prisma,
  });

  // O EventBus e in-process: o listener precisa ser registrado no mesmo
  // processo que publica o evento OSStatusAlterado (use cases de
  // ordens-servico, acionados via HTTP acima).
  registerPortalClienteRoutes(app, {
    prisma,
    armazenamentoArquivoService: container.midias.armazenamentoArquivoService,
  });
  registerNpsRoutes(app, { prisma, redis: redisConnection });
  registerWebhookMercadoPagoRoutes(app, { prisma });
  registerPagamentoRoutes(app);
  registerFinanceiroRoutes(app, { prisma });
  await agendarAlertaInadimplencia(alertaInadimplenciaQueue);
  registerFinanceiroRecorrenteRoutes(app, {
    contaReceberRepository: new PrismaContaReceberRepository(prisma),
    contratoRecorrenteRepository: new PrismaContratoRecorrenteRepository(prisma),
    clienteRepository: container.clientes.clienteRepository,
  });
  await agendarFaturamentoRecorrente(faturamentoRecorrenteQueue);
  registerRastreioTecnicoRoutes(app, {
    rastreioRepository: new PrismaRastreioTecnicoRepository(prisma),
    ordemAgendadaRepository: new PrismaOrdemAgendadaRepository(prisma),
    buscarOS: new PrismaBuscarOSParaRastreio(prisma),
    notificarClienteACaminho: async ({ ordemServicoId, clienteId }) => {
      await enqueueNotificacaoWhatsapp({
        ordemServicoId,
        clienteId,
        statusNovo: 'a caminho',
        templateNome: process.env.META_TEMPLATE_TECNICO_A_CAMINHO ?? 'tecnico_a_caminho',
      });
    },
  });
  registerEstoqueRoutes(app, { prisma });
  registerConsumoPecasRoutes(app, { prisma });
  const manutencaoQueue = new Queue('alerta-manutencao', { connection: redisConnection });
  registerManutencaoPreventivaRoutes(app, { prisma });
  await agendarAlertaManutencao(manutencaoQueue);
  void lembreteAgendamentoWorker;
  await agendarLembreteAgendamento(lembreteAgendamentoQueue);
  registerApiPublicaRoutes(app, { prisma, redis: redisConnection });
  registerRelatoriosExcelRoutes(app, { prisma });

  registrarNotificarMudancaStatusListener(container.eventBus, enqueueNotificacaoWhatsapp);

  // OS concluida via painel (rota HTTP acima): dispara geracao/envio de Pix.
  registrarGerarPixAoConcluirOSListener(container.eventBus, enqueuePixWhatsapp);

  registrarEnfileirarNpsListener(container.eventBus, enqueueNpsPesquisa);

  // Idem para OSCriada: publicado por CriarOrdemServicoUseCase quando a OS e
  // criada via painel (rota HTTP acima).
  registrarEntregarPdfOSListener(container.eventBus, enqueueEntregaPdfOS);

  // Idem para TecnicoAtribuidoOS: publicado ao atribuir um tecnico a uma OS
  // via painel (rota HTTP acima).
  registrarNotificarTecnicoAtribuidoListener(
    container.eventBus,
    enqueueNotificacaoTecnico,
    async (tecnicoId, ordemServicoId) => {
      const tecnico = await prisma.usuario.findUnique({
        where: { id: tecnicoId },
        select: { expoPushToken: true },
      });
      if (tecnico?.expoPushToken) {
        await enqueueExpoPush({
          expoPushToken: tecnico.expoPushToken,
          titulo: 'Nova OS atribuida',
          corpo: 'Voce foi atribuido a uma nova ordem de servico.',
          data: { osId: ordemServicoId },
        });
      }
    },
  );

  const calendarService = new GoogleCalendarService();
  registrarSincronizarCalendarioListener(container.eventBus, calendarService, prisma);

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Servidor rodando em http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error({ err }, 'Falha ao iniciar o servidor');
    process.exit(1);
  }
}

start();
