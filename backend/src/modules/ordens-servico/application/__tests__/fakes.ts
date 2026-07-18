import type { HistoricoStatusOS } from '../../domain/HistoricoStatusOS';
import type {
  CriarHistoricoStatusOSDados,
  HistoricoStatusOSRepository,
  ListarHistoricoOpcoes,
  ListarHistoricoResultado,
} from '../../domain/HistoricoStatusOSRepository';
import type { NumeroOSGenerator } from '../../domain/NumeroOSGenerator';
import type { OrdemServico, StatusOS } from '../../domain/OrdemServico';
import type {
  AtualizarOrdemServicoDados,
  CriarOrdemServicoDados,
  HistoricoOSItem,
  ListarOrdensServicoFiltros,
  ListarOrdensServicoOpcoes,
  ListarOrdensServicoResultado,
  OrdemServicoCompleta,
  OrdemServicoRepository,
} from '../../domain/OrdemServicoRepository';

/**
 * Fakes em memoria dos repositorios de ordens-servico, usados nos testes de
 * use case (sem Postgres real).
 */
export class FakeOrdemServicoRepository implements OrdemServicoRepository {
  public ordens: OrdemServico[] = [];
  private seq = 0;

  seed(ordemServico: OrdemServico): void {
    this.ordens.push(ordemServico);
  }

  async create(dados: CriarOrdemServicoDados): Promise<OrdemServico> {
    this.seq += 1;
    const agora = new Date();
    const ordemServico: OrdemServico = {
      id: `os-${this.seq}`,
      numero: dados.numero,
      clienteId: dados.clienteId,
      categoriaServicoId: dados.categoriaServicoId,
      descricaoProblema: dados.descricaoProblema,
      enderecoAtendimento: dados.enderecoAtendimento,
      prioridade: dados.prioridade,
      status: dados.status,
      tipoChamado: dados.tipoChamado ?? 'servico',
      criadoPorUsuarioId: dados.criadoPorUsuarioId,
      criadoVia: dados.criadoVia,
      dataAgendada: dados.dataAgendada,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.ordens.push(ordemServico);
    return ordemServico;
  }

  async findById(id: string): Promise<OrdemServico | null> {
    return this.ordens.find((ordem) => ordem.id === id) ?? null;
  }

  async findByNumero(numero: string): Promise<OrdemServico | null> {
    const normalizado = numero.trim().toUpperCase();

    if (!/^\d+$/.test(normalizado)) {
      return this.ordens.find((ordem) => ordem.numero.toUpperCase() === normalizado) ?? null;
    }

    const sequencia = normalizado.padStart(6, '0');
    const encontradas = this.ordens
      .filter((ordem) => ordem.numero.toUpperCase().endsWith(`-${sequencia}`))
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
    return encontradas[0] ?? null;
  }

  async update(id: string, dados: AtualizarOrdemServicoDados): Promise<OrdemServico> {
    const ordemServico = this.ordens.find((ordem) => ordem.id === id);
    if (!ordemServico) {
      throw new Error(`OrdemServico ${id} nao encontrada (fake)`);
    }

    if (dados.descricaoProblema !== undefined) ordemServico.descricaoProblema = dados.descricaoProblema;
    if (dados.enderecoAtendimento !== undefined) ordemServico.enderecoAtendimento = dados.enderecoAtendimento;
    if (dados.prioridade !== undefined) ordemServico.prioridade = dados.prioridade;
    if (dados.dataAgendada !== undefined) ordemServico.dataAgendada = dados.dataAgendada;
    if (dados.status !== undefined) ordemServico.status = dados.status;
    if (dados.tecnicoId !== undefined) ordemServico.tecnicoId = dados.tecnicoId;
    if (dados.ajudanteId !== undefined) ordemServico.ajudanteId = dados.ajudanteId;
    if (dados.fechadoEm !== undefined) ordemServico.fechadoEm = dados.fechadoEm ?? undefined;
    if (dados.valorCobrado !== undefined) ordemServico.valorCobrado = dados.valorCobrado;
    ordemServico.atualizadoEm = new Date();

    return ordemServico;
  }

  async atualizarStatusSeAtual(
    id: string,
    statusEsperado: StatusOS,
    dados: Pick<AtualizarOrdemServicoDados, 'status' | 'fechadoEm'>,
  ): Promise<OrdemServico | null> {
    const ordemServico = this.ordens.find((ordem) => ordem.id === id);
    if (!ordemServico || ordemServico.status !== statusEsperado) {
      return null;
    }

    if (dados.status !== undefined) ordemServico.status = dados.status;
    if (dados.fechadoEm !== undefined) ordemServico.fechadoEm = dados.fechadoEm ?? undefined;
    ordemServico.atualizadoEm = new Date();

    return ordemServico;
  }

  async list(
    filtros: ListarOrdensServicoFiltros,
    opcoes: ListarOrdensServicoOpcoes,
  ): Promise<ListarOrdensServicoResultado> {
    const filtradas = this.ordens.filter((ordem) => {
      if (filtros.status && ordem.status !== filtros.status) return false;
      if (filtros.tecnicoId && ordem.tecnicoId !== filtros.tecnicoId) return false;
      if (filtros.clienteId && ordem.clienteId !== filtros.clienteId) return false;
      return true;
    });

    const start = (opcoes.page - 1) * opcoes.pageSize;
    return { itens: filtradas.slice(start, start + opcoes.pageSize), total: filtradas.length };
  }

  async buscarConflitosDeHorario(usuarioId: string, dataHora: Date): Promise<OrdemServico[]> {
    return this.ordens.filter((ordem) => {
      const envolveUsuario = ordem.tecnicoId === usuarioId || ordem.ajudanteId === usuarioId;
      const mesmoHorario = ordem.dataAgendada?.getTime() === dataHora.getTime();
      const naoCancelada = ordem.status !== 'cancelada';
      return envolveUsuario && mesmoHorario && naoCancelada;
    });
  }

  async findByClienteId(clienteId: string, excluirOsId?: string): Promise<HistoricoOSItem[]> {
    return this.ordens
      .filter((ordem) => ordem.clienteId === clienteId && (excluirOsId ? ordem.id !== excluirOsId : true))
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
      .slice(0, 10)
      .map((ordem) => ({
        id: ordem.id,
        numero: ordem.numero,
        status: ordem.status,
        prioridade: ordem.prioridade,
        descricaoProblema: ordem.descricaoProblema,
        categoriaNome: 'Categoria Fake',
        tecnicoNome: null,
        valorCobrado: ordem.valorCobrado ?? null,
        criadoEm: ordem.criadoEm,
        fechadoEm: ordem.fechadoEm ?? null,
      }));
  }

  async findByIdCompleto(id: string): Promise<OrdemServicoCompleta | null> {
    const ordemServico = this.ordens.find((ordem) => ordem.id === id);
    if (!ordemServico) return null;
    return {
      id: ordemServico.id,
      numero: ordemServico.numero,
      status: ordemServico.status,
      prioridade: ordemServico.prioridade,
      criadoEm: ordemServico.criadoEm,
      dataAgendada: ordemServico.dataAgendada ?? null,
      fechadoEm: ordemServico.fechadoEm ?? null,
      descricaoProblema: ordemServico.descricaoProblema,
      enderecoAtendimento: ordemServico.enderecoAtendimento ?? null,
      criadoVia: ordemServico.criadoVia,
      valorCobrado: ordemServico.valorCobrado ?? null,
      cliente: { nome: 'Cliente Fake', telefoneWhatsapp: '11999999999', email: null, documento: null },
      categoriaServico: { nome: 'Categoria Fake', area: 'outro' },
      tecnico: null,
      ajudante: null,
      historicoStatus: [],
      estimativaCusto: null,
    };
  }
}

export class FakeHistoricoStatusOSRepository implements HistoricoStatusOSRepository {
  public historicos: HistoricoStatusOS[] = [];
  private seq = 0;

  async create(dados: CriarHistoricoStatusOSDados): Promise<HistoricoStatusOS> {
    this.seq += 1;
    const historico: HistoricoStatusOS = {
      id: `historico-${this.seq}`,
      ordemServicoId: dados.ordemServicoId,
      statusAnterior: dados.statusAnterior,
      statusNovo: dados.statusNovo,
      alteradoPorUsuarioId: dados.alteradoPorUsuarioId,
      alteradoPorBot: dados.alteradoPorBot,
      observacao: dados.observacao,
      criadoEm: new Date(),
    };
    this.historicos.push(historico);
    return historico;
  }

  async listByOrdemServicoId(
    ordemServicoId: string,
    opcoes: ListarHistoricoOpcoes,
  ): Promise<ListarHistoricoResultado> {
    const filtrados = this.historicos.filter((item) => item.ordemServicoId === ordemServicoId);
    const start = (opcoes.page - 1) * opcoes.pageSize;
    return { itens: filtrados.slice(start, start + opcoes.pageSize), total: filtrados.length };
  }
}

export class FakeNumeroOSGenerator implements NumeroOSGenerator {
  private contadorPorAnoMes = new Map<string, number>();

  async gerarNumero(ano: number, mes: number): Promise<string> {
    const mesFormatado = String(mes).padStart(2, '0');
    const chave = `${ano}-${mesFormatado}`;
    const proximo = (this.contadorPorAnoMes.get(chave) ?? 0) + 1;
    this.contadorPorAnoMes.set(chave, proximo);
    return `${ano}${mesFormatado}${String(proximo).padStart(2, '0')}`;
  }
}

export function criarOrdemServicoFake(overrides: Partial<OrdemServico> = {}): OrdemServico {
  const agora = new Date();
  return {
    id: 'os-seed-1',
    numero: 'OS-2026-000001',
    clienteId: 'cliente-1',
    categoriaServicoId: 'categoria-1',
    descricaoProblema: 'Problema de exemplo',
    prioridade: 'normal',
    status: 'aberta',
    tipoChamado: 'servico',
    criadoVia: 'painel',
    criadoEm: agora,
    atualizadoEm: agora,
    ...overrides,
  };
}
