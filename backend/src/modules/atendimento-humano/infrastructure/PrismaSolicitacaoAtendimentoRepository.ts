import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type {
  SolicitacaoAtendimento,
  StatusSolicitacaoAtendimento,
} from '../domain/SolicitacaoAtendimento';
import type {
  CriarSolicitacaoAtendimentoDados,
  MarcarComoRespondidaDados,
  SolicitacaoAtendimentoRepository,
} from '../domain/SolicitacaoAtendimentoRepository';

/** Implementacao de SolicitacaoAtendimentoRepository sobre o Prisma Client. */
export class PrismaSolicitacaoAtendimentoRepository implements SolicitacaoAtendimentoRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(dados: CriarSolicitacaoAtendimentoDados): Promise<SolicitacaoAtendimento> {
    return this.client.solicitacaoAtendimento.create({
      data: {
        clienteId: dados.clienteId,
        conversaId: dados.conversaId,
        mensagemCliente: dados.mensagemCliente,
        status: 'pendente',
      },
    });
  }

  async list(status?: StatusSolicitacaoAtendimento): Promise<SolicitacaoAtendimento[]> {
    return this.client.solicitacaoAtendimento.findMany({
      where: status ? { status } : undefined,
      orderBy: { criadoEm: 'asc' },
    });
  }

  async findById(id: string): Promise<SolicitacaoAtendimento | null> {
    return this.client.solicitacaoAtendimento.findUnique({ where: { id } });
  }

  async marcarComoRespondida(
    id: string,
    dados: MarcarComoRespondidaDados,
  ): Promise<SolicitacaoAtendimento> {
    return this.client.solicitacaoAtendimento.update({
      where: { id },
      data: {
        status: 'respondida',
        respostaTexto: dados.respostaTexto,
        respondidoPorUsuarioId: dados.respondidoPorUsuarioId,
        salvarComoFaq: dados.salvarComoFaq,
        respondidoEm: new Date(),
      },
    });
  }
}
