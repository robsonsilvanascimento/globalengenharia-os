import type { StatusOS } from './OrdemServico';

/**
 * Entidade de dominio pura do historico de alteracoes de status de uma
 * Ordem de Servico. Nao depende do Prisma nem de qualquer detalhe de
 * infraestrutura.
 */
export interface HistoricoStatusOS {
  id: string;
  ordemServicoId: string;
  statusAnterior?: StatusOS;
  statusNovo: StatusOS;
  alteradoPorUsuarioId?: string;
  alteradoPorBot: boolean;
  observacao?: string;
  criadoEm: Date;
}
