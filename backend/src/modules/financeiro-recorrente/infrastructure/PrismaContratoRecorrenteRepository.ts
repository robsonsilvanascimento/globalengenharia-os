import type { ContratoRecorrente as ContratoPrisma, PrismaClient } from '@prisma/client';
import type { ContratoRecorrente } from '../domain/ContratoRecorrente';
import type {
  ContratoComCliente,
  ContratoRecorrenteRepository,
  CriarContratoDados,
} from '../domain/ContratoRecorrenteRepository';
import type { Periodicidade } from '../domain/periodicidade';

function paraEntidade(r: ContratoPrisma): ContratoRecorrente {
  return {
    id: r.id,
    clienteId: r.clienteId,
    descricao: r.descricao,
    valor: r.valor,
    periodicidade: r.periodicidade as Periodicidade,
    proximaCobrancaEm: r.proximaCobrancaEm,
    dataInicio: r.dataInicio,
    dataFim: r.dataFim,
    ativo: r.ativo,
    criadoPorId: r.criadoPorId,
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
  };
}

export class PrismaContratoRecorrenteRepository implements ContratoRecorrenteRepository {
  constructor(private readonly client: PrismaClient) {}

  async criar(dados: CriarContratoDados): Promise<ContratoRecorrente> {
    const registro = await this.client.contratoRecorrente.create({
      data: {
        clienteId: dados.clienteId,
        descricao: dados.descricao,
        valor: dados.valor,
        periodicidade: dados.periodicidade,
        proximaCobrancaEm: dados.proximaCobrancaEm,
        dataInicio: dados.dataInicio,
        dataFim: dados.dataFim ?? null,
        criadoPorId: dados.criadoPorId ?? null,
      },
    });
    return paraEntidade(registro);
  }

  async buscarPorId(id: string): Promise<ContratoRecorrente | null> {
    const registro = await this.client.contratoRecorrente.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async listar(filtro: { ativo?: boolean; clienteId?: string }): Promise<ContratoComCliente[]> {
    const registros = await this.client.contratoRecorrente.findMany({
      where: {
        ...(filtro.ativo === undefined ? {} : { ativo: filtro.ativo }),
        ...(filtro.clienteId ? { clienteId: filtro.clienteId } : {}),
      },
      include: { cliente: { select: { nome: true } } },
      orderBy: [{ ativo: 'desc' }, { proximaCobrancaEm: 'asc' }],
    });
    return registros.map((r) => ({ ...paraEntidade(r), clienteNome: r.cliente.nome }));
  }

  async definirAtivo(id: string, ativo: boolean): Promise<ContratoRecorrente> {
    const registro = await this.client.contratoRecorrente.update({ where: { id }, data: { ativo } });
    return paraEntidade(registro);
  }

  async atualizarProximaCobranca(id: string, proximaCobrancaEm: Date): Promise<ContratoRecorrente> {
    const registro = await this.client.contratoRecorrente.update({ where: { id }, data: { proximaCobrancaEm } });
    return paraEntidade(registro);
  }

  async listarVencendoAte(referencia: Date): Promise<ContratoRecorrente[]> {
    const registros = await this.client.contratoRecorrente.findMany({
      where: { ativo: true, proximaCobrancaEm: { lte: referencia } },
    });
    return registros.map(paraEntidade);
  }
}
