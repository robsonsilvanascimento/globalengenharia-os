import type { HistoricoStatusOS as HistoricoStatusOSPrisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { HistoricoStatusOS } from '../domain/HistoricoStatusOS';
import type {
  CriarHistoricoStatusOSDados,
  HistoricoStatusOSRepository,
  ListarHistoricoOpcoes,
  ListarHistoricoResultado,
} from '../domain/HistoricoStatusOSRepository';

/** Converte o registro do Prisma (campos opcionais como `null`) para a entidade de dominio (campos opcionais como `undefined`). */
function paraEntidade(registro: HistoricoStatusOSPrisma): HistoricoStatusOS {
  return {
    id: registro.id,
    ordemServicoId: registro.ordemServicoId,
    statusAnterior: registro.statusAnterior ?? undefined,
    statusNovo: registro.statusNovo,
    alteradoPorUsuarioId: registro.alteradoPorUsuarioId ?? undefined,
    alteradoPorBot: registro.alteradoPorBot,
    observacao: registro.observacao ?? undefined,
    criadoEm: registro.criadoEm,
  };
}

/** Implementacao de HistoricoStatusOSRepository sobre o Prisma Client. */
export class PrismaHistoricoStatusOSRepository implements HistoricoStatusOSRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(dados: CriarHistoricoStatusOSDados): Promise<HistoricoStatusOS> {
    const registro = await this.client.historicoStatusOS.create({
      data: {
        ordemServicoId: dados.ordemServicoId,
        statusAnterior: dados.statusAnterior,
        statusNovo: dados.statusNovo,
        alteradoPorUsuarioId: dados.alteradoPorUsuarioId,
        alteradoPorBot: dados.alteradoPorBot,
        observacao: dados.observacao,
      },
    });
    return paraEntidade(registro);
  }

  async listByOrdemServicoId(
    ordemServicoId: string,
    opcoes: ListarHistoricoOpcoes,
  ): Promise<ListarHistoricoResultado> {
    const where = { ordemServicoId };

    const [registros, total] = await Promise.all([
      this.client.historicoStatusOS.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (opcoes.page - 1) * opcoes.pageSize,
        take: opcoes.pageSize,
      }),
      this.client.historicoStatusOS.count({ where }),
    ]);

    return { itens: registros.map(paraEntidade), total };
  }
}
