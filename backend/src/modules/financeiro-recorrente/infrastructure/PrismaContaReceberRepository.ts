import type { ContaReceber as ContaPrisma, Prisma, PrismaClient } from '@prisma/client';
import type { ContaReceber, StatusContaReceber } from '../domain/ContaReceber';
import type {
  BaixaContaReceber,
  ContaReceberComCliente,
  ContaReceberRepository,
  CriarContaReceberDados,
  FiltroContasReceber,
} from '../domain/ContaReceberRepository';

function paraEntidade(r: ContaPrisma): ContaReceber {
  return {
    id: r.id,
    numero: r.numero,
    clienteId: r.clienteId,
    contratoId: r.contratoId,
    descricao: r.descricao,
    valor: r.valor,
    vencimentoEm: r.vencimentoEm,
    status: r.status as StatusContaReceber,
    pagoEm: r.pagoEm,
    valorPago: r.valorPago,
    formaPagamento: r.formaPagamento,
    observacao: r.observacao,
    criadoPorId: r.criadoPorId,
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
  };
}

export class PrismaContaReceberRepository implements ContaReceberRepository {
  constructor(private readonly client: PrismaClient) {}

  async criar(dados: CriarContaReceberDados): Promise<ContaReceber> {
    const registro = await this.client.contaReceber.create({
      data: {
        numero: dados.numero,
        clienteId: dados.clienteId,
        contratoId: dados.contratoId ?? null,
        descricao: dados.descricao,
        valor: dados.valor,
        vencimentoEm: dados.vencimentoEm,
        observacao: dados.observacao ?? null,
        criadoPorId: dados.criadoPorId ?? null,
      },
    });
    return paraEntidade(registro);
  }

  async buscarPorId(id: string): Promise<ContaReceber | null> {
    const registro = await this.client.contaReceber.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async listar(filtro: FiltroContasReceber): Promise<ContaReceberComCliente[]> {
    const where: Prisma.ContaReceberWhereInput = {};
    if (filtro.status) where.status = filtro.status;
    if (filtro.clienteId) where.clienteId = filtro.clienteId;
    if (filtro.contratoId) where.contratoId = filtro.contratoId;
    if (filtro.vencimentoInicio || filtro.vencimentoFim) {
      where.vencimentoEm = {};
      if (filtro.vencimentoInicio) where.vencimentoEm.gte = filtro.vencimentoInicio;
      if (filtro.vencimentoFim) where.vencimentoEm.lte = filtro.vencimentoFim;
    }

    const registros = await this.client.contaReceber.findMany({
      where,
      include: { cliente: { select: { nome: true } } },
      orderBy: [{ vencimentoEm: 'asc' }],
    });
    return registros.map((r) => ({ ...paraEntidade(r), clienteNome: r.cliente.nome }));
  }

  async baixar(id: string, dados: BaixaContaReceber): Promise<ContaReceber> {
    const registro = await this.client.contaReceber.update({
      where: { id },
      data: {
        status: 'paga',
        pagoEm: dados.pagoEm,
        valorPago: dados.valorPago,
        formaPagamento: dados.formaPagamento ?? null,
      },
    });
    return paraEntidade(registro);
  }

  async atualizarStatus(id: string, status: StatusContaReceber): Promise<ContaReceber> {
    const registro = await this.client.contaReceber.update({ where: { id }, data: { status } });
    return paraEntidade(registro);
  }

  async contarNoAno(ano: number): Promise<number> {
    const inicio = new Date(ano, 0, 1);
    const fim = new Date(ano + 1, 0, 1);
    return this.client.contaReceber.count({ where: { criadoEm: { gte: inicio, lt: fim } } });
  }

  async marcarVencidasAntesDe(referencia: Date): Promise<number> {
    const resultado = await this.client.contaReceber.updateMany({
      where: { status: 'aberta', vencimentoEm: { lt: referencia } },
      data: { status: 'vencida' },
    });
    return resultado.count;
  }

  async existeParaContratoNoVencimento(contratoId: string, vencimentoEm: Date): Promise<boolean> {
    const total = await this.client.contaReceber.count({ where: { contratoId, vencimentoEm } });
    return total > 0;
  }
}
