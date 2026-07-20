import type { OrdemServico as OrdemServicoPrisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { OrdemServico, StatusOS } from '../domain/OrdemServico';
import type {
  AtualizarOrdemServicoDados,
  CriarOrdemServicoDados,
  HistoricoOSItem,
  ListarOrdensServicoFiltros,
  ListarOrdensServicoOpcoes,
  ListarOrdensServicoResultado,
  OrdemServicoCompleta,
  OrdemServicoRepository,
} from '../domain/OrdemServicoRepository';

/** Converte o registro do Prisma (campos opcionais como `null`) para a entidade de dominio (campos opcionais como `undefined`). */
function paraEntidade(registro: OrdemServicoPrisma): OrdemServico {
  return {
    id: registro.id,
    numero: registro.numero,
    clienteId: registro.clienteId,
    categoriaServicoId: registro.categoriaServicoId,
    descricaoProblema: registro.descricaoProblema,
    enderecoAtendimento: registro.enderecoAtendimento ?? undefined,
    prioridade: registro.prioridade,
    status: registro.status,
    tipoChamado: registro.tipoChamado === 'emergencia' ? 'emergencia' : 'servico',
    tecnicoId: registro.tecnicoId ?? undefined,
    ajudanteId: registro.ajudanteId ?? undefined,
    criadoPorUsuarioId: registro.criadoPorUsuarioId ?? undefined,
    criadoVia: registro.criadoVia,
    dataAgendada: registro.dataAgendada ?? undefined,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
    fechadoEm: registro.fechadoEm ?? undefined,
    valorCobrado: registro.valorCobrado ? Number(registro.valorCobrado) : undefined,
    isPendente: registro.isPendente,
    slaVencido: registro.slaVencido,
  };
}

/** Implementacao de OrdemServicoRepository sobre o Prisma Client. */
export class PrismaOrdemServicoRepository implements OrdemServicoRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(dados: CriarOrdemServicoDados): Promise<OrdemServico> {
    const registro = await this.client.ordemServico.create({
      data: {
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
      },
    });
    return paraEntidade(registro);
  }

  async findById(id: string): Promise<OrdemServico | null> {
    const registro = await this.client.ordemServico.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async findByNumero(numero: string): Promise<OrdemServico | null> {
    const normalizado = numero.trim().toUpperCase();

    if (!/^\d+$/.test(normalizado)) {
      const registro = await this.client.ordemServico.findUnique({ where: { numero: normalizado } });
      return registro ? paraEntidade(registro) : null;
    }

    // Apenas digitos (sem prefixo OS-AAAA-): resolve pelo sequencial,
    // buscando o registro mais recente cujo numero termine com o
    // sequencial informado (zero-padded para 6 digitos, mesmo formato usado
    // por NumeroOSGenerator).
    const sequencia = normalizado.padStart(6, '0');
    const registro = await this.client.ordemServico.findFirst({
      where: { numero: { endsWith: `-${sequencia}` } },
      orderBy: { criadoEm: 'desc' },
    });
    return registro ? paraEntidade(registro) : null;
  }

  async update(id: string, dados: AtualizarOrdemServicoDados): Promise<OrdemServico> {
    const registro = await this.client.ordemServico.update({
      where: { id },
      data: {
        descricaoProblema: dados.descricaoProblema,
        enderecoAtendimento: dados.enderecoAtendimento,
        prioridade: dados.prioridade,
        dataAgendada: dados.dataAgendada,
        status: dados.status,
        tecnicoId: dados.tecnicoId,
        ajudanteId: dados.ajudanteId,
        fechadoEm: dados.fechadoEm,
        valorCobrado: dados.valorCobrado,
        isPendente: dados.isPendente,
      },
    });
    return paraEntidade(registro);
  }

  async atualizarStatusSeAtual(
    id: string,
    statusEsperado: StatusOS,
    dados: Pick<AtualizarOrdemServicoDados, 'status' | 'fechadoEm'>,
  ): Promise<OrdemServico | null> {
    const resultado = await this.client.ordemServico.updateMany({
      where: { id, status: statusEsperado },
      data: {
        status: dados.status,
        fechadoEm: dados.fechadoEm,
      },
    });

    if (resultado.count === 0) {
      return null;
    }

    const registro = await this.client.ordemServico.findUniqueOrThrow({ where: { id } });
    return paraEntidade(registro);
  }

  async list(
    filtros: ListarOrdensServicoFiltros,
    opcoes: ListarOrdensServicoOpcoes,
  ): Promise<ListarOrdensServicoResultado> {
    const where = {
      status: filtros.status,
      tecnicoId: filtros.tecnicoId,
      ajudanteId: filtros.ajudanteId,
      clienteId: filtros.clienteId,
    };

    const [registros, total] = await Promise.all([
      this.client.ordemServico.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (opcoes.page - 1) * opcoes.pageSize,
        take: opcoes.pageSize,
      }),
      this.client.ordemServico.count({ where }),
    ]);

    return { itens: registros.map(paraEntidade), total };
  }

  async findByIdCompleto(id: string): Promise<OrdemServicoCompleta | null> {
    const registro = await this.client.ordemServico.findUnique({
      where: { id },
      include: {
        cliente: { select: { nome: true, telefoneWhatsapp: true, email: true, documento: true } },
        categoriaServico: { select: { nome: true, area: true } },
        tecnico: { select: { nome: true } },
        ajudante: { select: { nome: true } },
        historicoStatus: { orderBy: { criadoEm: 'asc' } },
        estimativaCusto: true,
      },
    });

    if (!registro) return null;

    return {
      id: registro.id,
      numero: registro.numero,
      status: registro.status,
      prioridade: registro.prioridade,
      criadoEm: registro.criadoEm,
      dataAgendada: registro.dataAgendada,
      fechadoEm: registro.fechadoEm,
      descricaoProblema: registro.descricaoProblema,
      enderecoAtendimento: registro.enderecoAtendimento,
      criadoVia: registro.criadoVia,
      valorCobrado: registro.valorCobrado != null ? Number(registro.valorCobrado) : null,
      cliente: registro.cliente,
      categoriaServico: { nome: registro.categoriaServico.nome, area: registro.categoriaServico.area },
      tecnico: registro.tecnico,
      ajudante: registro.ajudante,
      historicoStatus: registro.historicoStatus.map((h) => ({
        statusAnterior: h.statusAnterior,
        statusNovo: h.statusNovo,
        alteradoPorBot: h.alteradoPorBot,
        observacao: h.observacao,
        criadoEm: h.criadoEm,
      })),
      estimativaCusto: registro.estimativaCusto
        ? {
            horasEstimadasTecnico: Number(registro.estimativaCusto.horasEstimadasTecnico),
            valorHoraTecnico: Number(registro.estimativaCusto.valorHoraTecnico),
            horasEstimadasAjudante: registro.estimativaCusto.horasEstimadasAjudante != null ? Number(registro.estimativaCusto.horasEstimadasAjudante) : null,
            valorHoraAjudante: registro.estimativaCusto.valorHoraAjudante != null ? Number(registro.estimativaCusto.valorHoraAjudante) : null,
            custoCombustivel: Number(registro.estimativaCusto.custoCombustivel),
            custoPedagio: Number(registro.estimativaCusto.custoPedagio),
            custoDesgasteVeiculo: Number(registro.estimativaCusto.custoDesgasteVeiculo),
            custoAlmoco: Number(registro.estimativaCusto.custoAlmoco),
            custoJanta: Number(registro.estimativaCusto.custoJanta),
            custoEstadia: Number(registro.estimativaCusto.custoEstadia),
            turno: registro.estimativaCusto.turno,
            custoAdicionalNoturno: Number(registro.estimativaCusto.custoAdicionalNoturno),
            outrosCustos: Number(registro.estimativaCusto.outrosCustos),
            custoTotal: Number(registro.estimativaCusto.custoTotal),
          }
        : null,
    };
  }

  async findByClienteId(clienteId: string, excluirOsId?: string): Promise<HistoricoOSItem[]> {
    const registros = await this.client.ordemServico.findMany({
      where: {
        clienteId,
        ...(excluirOsId ? { id: { not: excluirOsId } } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      take: 10,
      include: {
        categoriaServico: { select: { nome: true } },
        tecnico: { select: { nome: true } },
      },
    });

    return registros.map((r) => ({
      id: r.id,
      numero: r.numero,
      status: r.status,
      prioridade: r.prioridade,
      descricaoProblema: r.descricaoProblema,
      categoriaNome: r.categoriaServico.nome,
      tecnicoNome: r.tecnico?.nome ?? null,
      valorCobrado: r.valorCobrado != null ? Number(r.valorCobrado) : null,
      criadoEm: r.criadoEm,
      fechadoEm: r.fechadoEm ?? null,
    }));
  }

  async buscarConflitosDeHorario(usuarioId: string, dataHora: Date): Promise<OrdemServico[]> {
    const registros = await this.client.ordemServico.findMany({
      where: {
        OR: [{ tecnicoId: usuarioId }, { ajudanteId: usuarioId }],
        dataAgendada: dataHora,
        status: { not: 'cancelada' },
      },
    });
    return registros.map(paraEntidade);
  }
}
