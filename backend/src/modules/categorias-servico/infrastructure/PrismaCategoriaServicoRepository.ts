import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { CategoriaServico } from '../domain/CategoriaServico';
import type {
  AtualizarCategoriaServicoDados,
  CategoriaServicoRepository,
  CriarCategoriaServicoDados,
} from '../domain/CategoriaServicoRepository';

/** Implementacao de CategoriaServicoRepository sobre o Prisma Client. */
export class PrismaCategoriaServicoRepository implements CategoriaServicoRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(incluirInativas: boolean): Promise<CategoriaServico[]> {
    return this.client.categoriaServico.findMany({
      where: incluirInativas ? undefined : { ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  async findById(id: string): Promise<CategoriaServico | null> {
    return this.client.categoriaServico.findUnique({ where: { id } });
  }

  async create(dados: CriarCategoriaServicoDados): Promise<CategoriaServico> {
    return this.client.categoriaServico.create({
      data: {
        nome: dados.nome,
        area: dados.area,
        ativo: dados.ativo ?? true,
      },
    });
  }

  async update(id: string, dados: AtualizarCategoriaServicoDados): Promise<CategoriaServico> {
    return this.client.categoriaServico.update({
      where: { id },
      data: dados,
    });
  }
}
