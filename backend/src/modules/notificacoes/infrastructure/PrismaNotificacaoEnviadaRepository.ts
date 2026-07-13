import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { NotificacaoEnviada } from '../domain/NotificacaoEnviada';
import type {
  CriarNotificacaoEnviadaDados,
  NotificacaoEnviadaRepository,
} from '../domain/NotificacaoEnviadaRepository';

/** Implementacao de NotificacaoEnviadaRepository sobre o Prisma Client. */
export class PrismaNotificacaoEnviadaRepository implements NotificacaoEnviadaRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(dados: CriarNotificacaoEnviadaDados): Promise<NotificacaoEnviada> {
    return this.client.notificacaoEnviada.create({
      data: {
        ordemServicoId: dados.ordemServicoId,
        clienteId: dados.clienteId,
        tipoEvento: dados.tipoEvento,
        templateUsado: dados.templateUsado,
        statusEnvio: dados.statusEnvio,
        tentativas: dados.tentativas,
        enviadoEm: dados.enviadoEm,
      },
    });
  }
}
