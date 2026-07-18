import type { OrdemServico, OrigemCriacaoOS, PrioridadeOS, StatusOS } from './OrdemServico';

export interface OrdemServicoCompleta {
  id: string;
  numero: string;
  status: string;
  prioridade: string;
  criadoEm: Date;
  dataAgendada?: Date | null;
  fechadoEm?: Date | null;
  descricaoProblema: string;
  enderecoAtendimento?: string | null;
  criadoVia: string;
  valorCobrado?: number | null;
  cliente: { nome: string; telefoneWhatsapp: string; email?: string | null; documento?: string | null };
  categoriaServico: { nome: string; area: string };
  tecnico?: { nome: string } | null;
  ajudante?: { nome: string } | null;
  historicoStatus: Array<{
    statusAnterior?: string | null;
    statusNovo: string;
    alteradoPorBot: boolean;
    observacao?: string | null;
    criadoEm: Date;
  }>;
  estimativaCusto?: {
    horasEstimadasTecnico: number | { toNumber(): number };
    valorHoraTecnico: number | { toNumber(): number };
    horasEstimadasAjudante?: (number | { toNumber(): number }) | null;
    valorHoraAjudante?: (number | { toNumber(): number }) | null;
    custoCombustivel: number | { toNumber(): number };
    custoPedagio: number | { toNumber(): number };
    custoDesgasteVeiculo: number | { toNumber(): number };
    custoAlmoco: number | { toNumber(): number };
    custoJanta: number | { toNumber(): number };
    custoEstadia: number | { toNumber(): number };
    turno: string;
    custoAdicionalNoturno: number | { toNumber(): number };
    outrosCustos: number | { toNumber(): number };
    custoTotal: number | { toNumber(): number };
  } | null;
}

/** Dados necessarios para criar uma OrdemServico. `id`, `criadoEm` e `atualizadoEm` sao gerados pela implementacao. */
export interface CriarOrdemServicoDados {
  numero: string;
  clienteId: string;
  categoriaServicoId: string;
  descricaoProblema: string;
  enderecoAtendimento?: string;
  prioridade: PrioridadeOS;
  status: StatusOS;
  criadoPorUsuarioId?: string;
  criadoVia: OrigemCriacaoOS;
  dataAgendada?: Date;
}

/**
 * Dados parciais aceitos em uma atualizacao de OrdemServico. Cobre tanto os
 * campos gerais (editados via AtualizarOrdemServicoUseCase) quanto os campos
 * de status/tecnico/fechamento (editados via AtualizarStatusOrdemServicoUseCase
 * e AtribuirTecnicoUseCase).
 */
export interface AtualizarOrdemServicoDados {
  descricaoProblema?: string;
  enderecoAtendimento?: string;
  prioridade?: PrioridadeOS;
  dataAgendada?: Date;
  status?: StatusOS;
  tecnicoId?: string;
  ajudanteId?: string;
  fechadoEm?: Date | null;
  valorCobrado?: number;
  isPendente?: boolean;
}

export interface ListarOrdensServicoFiltros {
  status?: StatusOS;
  tecnicoId?: string;
  clienteId?: string;
}

export interface ListarOrdensServicoOpcoes {
  page: number;
  pageSize: number;
}

export interface ListarOrdensServicoResultado {
  itens: OrdemServico[];
  total: number;
}

export interface HistoricoOSItem {
  id: string;
  numero: string;
  status: string;
  prioridade: string;
  descricaoProblema: string;
  categoriaNome: string;
  tecnicoNome: string | null;
  valorCobrado: number | null;
  criadoEm: Date;
  fechadoEm: Date | null;
}

/**
 * Contrato de persistencia para OrdemServico. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 */
export interface OrdemServicoRepository {
  create(dados: CriarOrdemServicoDados): Promise<OrdemServico>;
  findById(id: string): Promise<OrdemServico | null>;
  /**
   * Busca uma OS pelo numero informado pelo cliente. Aceita tanto o numero
   * completo (`OS-2026-000123`, case-insensitive) quanto apenas a parte
   * numerica/sequencial (`123`, `000123`), caso em que a implementacao deve
   * resolver por sufixo (o sequencial mais recente que combine).
   */
  findByNumero(numero: string): Promise<OrdemServico | null>;
  update(id: string, dados: AtualizarOrdemServicoDados): Promise<OrdemServico>;
  /**
   * Atualiza os dados de status/fechamento apenas se o status atual no banco
   * ainda for `statusEsperado` (compare-and-swap otimista, equivalente a um
   * `UPDATE ... WHERE id = ? AND status = ?`). Retorna `null` quando nenhuma
   * linha foi afetada porque o status ja havia mudado entre a leitura feita
   * pelo caller e esta chamada — sinal de que houve uma transicao
   * concorrente, para o caller tratar como conflito em vez de sobrescrever
   * silenciosamente a mudanca alheia.
   */
  atualizarStatusSeAtual(
    id: string,
    statusEsperado: StatusOS,
    dados: Pick<AtualizarOrdemServicoDados, 'status' | 'fechadoEm'>,
  ): Promise<OrdemServico | null>;
  list(
    filtros: ListarOrdensServicoFiltros,
    opcoes: ListarOrdensServicoOpcoes,
  ): Promise<ListarOrdensServicoResultado>;
  /**
   * Busca OS que conflitam com o horario informado para o usuario dado
   * (seja como tecnico ou como ajudante). Considera apenas OS com
   * `dataAgendada` exatamente igual a `dataHora` (mesmo minuto) e que nao
   * estejam canceladas. Usado pela checagem de disponibilidade.
   */
  buscarConflitosDeHorario(usuarioId: string, dataHora: Date): Promise<OrdemServico[]>;
  findByIdCompleto(id: string): Promise<OrdemServicoCompleta | null>;
  findByClienteId(clienteId: string, excluirOsId?: string): Promise<HistoricoOSItem[]>;
}
