import { prisma } from '../shared/infra/PrismaClient';
import { redisConnection } from '../shared/infra/RedisConnection';
import { eventBus } from '../shared/domain/EventBus';
import {
  whatsappConversaQueue,
  notificacoesWhatsappQueue,
} from '../shared/infra/queues';
import { PrismaUsuarioRepository } from '../modules/auth/infrastructure/PrismaUsuarioRepository';
import { BcryptHashService } from '../modules/auth/infrastructure/BcryptHashService';
import { JwtTokenService } from '../modules/auth/infrastructure/JwtTokenService';
import { PrismaCategoriaServicoRepository } from '../modules/categorias-servico/infrastructure/PrismaCategoriaServicoRepository';
import { PrismaFaqEntryRepository } from '../modules/faq/infrastructure/PrismaFaqEntryRepository';
import { PrismaClienteRepository } from '../modules/clientes/infrastructure/PrismaClienteRepository';
import { PrismaOrdemServicoRepository } from '../modules/ordens-servico/infrastructure/PrismaOrdemServicoRepository';
import { PrismaHistoricoStatusOSRepository } from '../modules/ordens-servico/infrastructure/PrismaHistoricoStatusOSRepository';
import { PrismaNumeroOSGenerator } from '../modules/ordens-servico/infrastructure/PrismaNumeroOSGenerator';
import { PrismaNotificacaoEnviadaRepository } from '../modules/notificacoes/infrastructure/PrismaNotificacaoEnviadaRepository';
import { PrismaConversaWhatsappRepository } from '../modules/whatsapp/infrastructure/PrismaConversaWhatsappRepository';
import { PrismaMensagemWhatsappRepository } from '../modules/whatsapp/infrastructure/PrismaMensagemWhatsappRepository';
import { PrismaSolicitacaoAtendimentoRepository } from '../modules/atendimento-humano/infrastructure/PrismaSolicitacaoAtendimentoRepository';
import { PrismaMidiaOrdemServicoRepository } from '../modules/midias/infrastructure/PrismaMidiaOrdemServicoRepository';
import { ArmazenamentoLocalService } from '../shared/infra/storage/ArmazenamentoLocalService';
import { PrismaEstimativaCustoOSRepository } from '../modules/estimativa-custo/infrastructure/PrismaEstimativaCustoOSRepository';
import { PrismaComponenteInstaladoRepository } from '../modules/rastreabilidade/infrastructure/PrismaComponenteInstaladoRepository';
import { PrismaDocumentoOSRepository } from '../modules/rastreabilidade/infrastructure/PrismaDocumentoOSRepository';
import { PrismaAuditLogRepository } from '../shared/infra/auditoria/AuditLogService';
import { PrismaPendenciaOSRepository } from '../modules/pendencias/infrastructure/PrismaPendenciaOSRepository';
import { PrismaChecklistRepository } from '../modules/checklist/infrastructure/PrismaChecklistRepository';
import { PrismaFotoServicoRepository } from '../modules/fotos-servico/infrastructure/PrismaFotoServicoRepository';

/**
 * Container de dependencias simples (sem framework de DI).
 * Repositorios/servicos de cada modulo sao registrados aqui conforme
 * implementados.
 */
export const container = {
  prisma,
  redis: redisConnection,
  eventBus,
  queues: {
    whatsappConversa: whatsappConversaQueue,
    notificacoesWhatsapp: notificacoesWhatsappQueue,
  },
  auth: {
    usuarioRepository: new PrismaUsuarioRepository(prisma),
    hashService: new BcryptHashService(),
    tokenService: new JwtTokenService(),
  },
  categoriasServico: {
    categoriaServicoRepository: new PrismaCategoriaServicoRepository(prisma),
  },
  faq: {
    faqEntryRepository: new PrismaFaqEntryRepository(prisma),
  },
  clientes: {
    clienteRepository: new PrismaClienteRepository(prisma),
  },
  ordensServico: {
    ordemServicoRepository: new PrismaOrdemServicoRepository(prisma),
    historicoStatusOSRepository: new PrismaHistoricoStatusOSRepository(prisma),
    numeroOSGenerator: new PrismaNumeroOSGenerator(prisma),
  },
  notificacoes: {
    notificacaoEnviadaRepository: new PrismaNotificacaoEnviadaRepository(prisma),
  },
  whatsapp: {
    conversaWhatsappRepository: new PrismaConversaWhatsappRepository(prisma),
    mensagemWhatsappRepository: new PrismaMensagemWhatsappRepository(prisma),
  },
  atendimentoHumano: {
    solicitacaoAtendimentoRepository: new PrismaSolicitacaoAtendimentoRepository(prisma),
  },
  midias: {
    midiaOrdemServicoRepository: new PrismaMidiaOrdemServicoRepository(prisma),
    armazenamentoArquivoService: new ArmazenamentoLocalService(),
  },
  estimativaCusto: {
    estimativaCustoOSRepository: new PrismaEstimativaCustoOSRepository(prisma),
  },
  rastreabilidade: {
    componenteInstaladoRepository: new PrismaComponenteInstaladoRepository(prisma),
    documentoOSRepository: new PrismaDocumentoOSRepository(prisma),
    armazenamentoArquivoService: new ArmazenamentoLocalService(),
  },
  auditoria: {
    auditLogRepository: new PrismaAuditLogRepository(prisma),
  },
  pendencias: {
    pendenciaOSRepository: new PrismaPendenciaOSRepository(prisma),
  },
  checklist: {
    checklistRepository: new PrismaChecklistRepository(prisma),
  },
  fotosServico: {
    fotoServicoRepository: new PrismaFotoServicoRepository(prisma),
  },
  analytics: {
    prisma,
  },
  sla: {
    prisma,
  },
};

export type Container = typeof container;
