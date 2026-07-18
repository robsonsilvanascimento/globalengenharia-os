import type { ItemOrcamento, OrcamentoOS, StatusOrcamento } from './OrcamentoOS';

export interface SalvarOrcamentoDados {
  ordemServicoId: string;
  itens: ItemOrcamento[];
  valorTotal: number;
  observacao?: string;
  tokenAprovacao: string;
  criadoPorId: string;
}

export interface OrcamentoOSRepository {
  /**
   * Cria o orcamento da OS, ou substitui o existente quando ainda nao foi
   * aprovado (upsert por `ordemServicoId`). Reabre o status para "pendente" e
   * limpa `enviadoEm`/`respondidoEm`, ja que passa a ser uma nova proposta.
   */
  salvar(dados: SalvarOrcamentoDados): Promise<OrcamentoOS>;
  buscarPorOrdemServico(ordemServicoId: string): Promise<OrcamentoOS | null>;
  buscarPorToken(tokenAprovacao: string): Promise<OrcamentoOS | null>;
  marcarEnviado(id: string, enviadoEm: Date): Promise<OrcamentoOS>;
  registrarResposta(id: string, status: StatusOrcamento, respondidoEm: Date): Promise<OrcamentoOS>;
}
