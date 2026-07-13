import type { HistoricoStatusOS } from './HistoricoStatusOS';
import type { StatusOS } from './OrdemServico';

/** Dados necessarios para criar um registro de HistoricoStatusOS. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarHistoricoStatusOSDados {
  ordemServicoId: string;
  statusAnterior?: StatusOS;
  statusNovo: StatusOS;
  alteradoPorUsuarioId?: string;
  alteradoPorBot: boolean;
  observacao?: string;
}

export interface ListarHistoricoOpcoes {
  page: number;
  pageSize: number;
}

export interface ListarHistoricoResultado {
  itens: HistoricoStatusOS[];
  total: number;
}

/**
 * Contrato de persistencia para HistoricoStatusOS. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 */
export interface HistoricoStatusOSRepository {
  create(dados: CriarHistoricoStatusOSDados): Promise<HistoricoStatusOS>;
  listByOrdemServicoId(
    ordemServicoId: string,
    opcoes: ListarHistoricoOpcoes,
  ): Promise<ListarHistoricoResultado>;
}
