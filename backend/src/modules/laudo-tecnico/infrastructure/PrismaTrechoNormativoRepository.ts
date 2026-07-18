import type { PrismaClient, TrechoNormativo as TrechoPrisma } from '@prisma/client';
import type {
  AtualizarTrechoInput,
  CriarTrechoInput,
  ListarTrechosFiltro,
  TrechoNormativo,
} from '../domain/TrechoNormativo';
import type { TrechoNormativoRepository } from '../domain/TrechoNormativoRepository';

function paraEntidade(registro: TrechoPrisma): TrechoNormativo {
  return {
    id: registro.id,
    norma: registro.norma,
    item: registro.item,
    categoria: registro.categoria,
    assunto: registro.assunto,
    texto: registro.texto,
    itemVerificar: registro.itemVerificar,
    ativo: registro.ativo,
    criadoPorId: registro.criadoPorId,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export class PrismaTrechoNormativoRepository implements TrechoNormativoRepository {
  constructor(private readonly client: PrismaClient) {}

  async listar(filtro: ListarTrechosFiltro): Promise<TrechoNormativo[]> {
    const registros = await this.client.trechoNormativo.findMany({
      where: {
        ativo: true,
        ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
        ...(filtro.norma ? { norma: filtro.norma } : {}),
        ...(filtro.busca
          ? {
              OR: [
                { assunto: { contains: filtro.busca, mode: 'insensitive' } },
                { texto: { contains: filtro.busca, mode: 'insensitive' } },
                { item: { contains: filtro.busca, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ norma: 'asc' }, { assunto: 'asc' }],
    });
    return registros.map(paraEntidade);
  }

  async buscarPorId(id: string): Promise<TrechoNormativo | null> {
    const registro = await this.client.trechoNormativo.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async criar(dados: CriarTrechoInput): Promise<TrechoNormativo> {
    const registro = await this.client.trechoNormativo.create({
      data: {
        norma: dados.norma,
        item: dados.item ?? null,
        categoria: dados.categoria,
        assunto: dados.assunto,
        texto: dados.texto,
        itemVerificar: dados.itemVerificar ?? false,
        criadoPorId: dados.criadoPorId ?? null,
      },
    });
    return paraEntidade(registro);
  }

  async atualizar(id: string, dados: AtualizarTrechoInput): Promise<TrechoNormativo> {
    const registro = await this.client.trechoNormativo.update({
      where: { id },
      data: {
        norma: dados.norma,
        item: dados.item,
        categoria: dados.categoria,
        assunto: dados.assunto,
        texto: dados.texto,
        itemVerificar: dados.itemVerificar,
        ativo: dados.ativo,
      },
    });
    return paraEntidade(registro);
  }

  async desativar(id: string): Promise<void> {
    await this.client.trechoNormativo.update({ where: { id }, data: { ativo: false } });
  }

  async contarAtivos(): Promise<number> {
    return this.client.trechoNormativo.count({ where: { ativo: true } });
  }

  async criarVarios(lista: CriarTrechoInput[]): Promise<number> {
    const resultado = await this.client.trechoNormativo.createMany({
      data: lista.map((dados) => ({
        norma: dados.norma,
        item: dados.item ?? null,
        categoria: dados.categoria,
        assunto: dados.assunto,
        texto: dados.texto,
        itemVerificar: dados.itemVerificar ?? false,
        criadoPorId: dados.criadoPorId ?? null,
      })),
    });
    return resultado.count;
  }
}
