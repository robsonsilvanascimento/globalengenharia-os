import type { EstimativaCustoOS } from './EstimativaCustoOS';

/** Dados necessarios para criar/atualizar a EstimativaCustoOS de uma OS via upsert. */
export interface UpsertEstimativaCustoOSDados {
  horasEstimadasTecnico: number;
  valorHoraTecnico: number;
  horasEstimadasAjudante?: number;
  valorHoraAjudante?: number;
  custoCombustivel: number;
  custoPedagio: number;
  custoDesgasteVeiculo: number;
  custoAlmoco: number;
  custoJanta: number;
  custoEstadia: number;
  turno: 'diurno' | 'noturno';
  custoAdicionalNoturno: number;
  outrosCustos: number;
  custoTotal: number;
  criadoPorUsuarioId: string;
}

/**
 * Contrato de persistencia para EstimativaCustoOS. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 *
 * Relacao 1:1 com OrdemServico: `upsert` cria a estimativa na primeira chamada
 * e atualiza os valores nas chamadas seguintes (uma unica estimativa por OS).
 */
export interface EstimativaCustoOSRepository {
  findByOrdemServicoId(ordemServicoId: string): Promise<EstimativaCustoOS | null>;
  upsert(ordemServicoId: string, dados: UpsertEstimativaCustoOSDados): Promise<EstimativaCustoOS>;
}
