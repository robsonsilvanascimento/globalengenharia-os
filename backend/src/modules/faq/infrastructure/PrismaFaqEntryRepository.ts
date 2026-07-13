import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { FaqEntry } from '../domain/FaqEntry';
import type {
  AtualizarFaqEntryDados,
  CriarFaqEntryDados,
  FaqEntryRepository,
} from '../domain/FaqEntryRepository';

/** Implementacao de FaqEntryRepository sobre o Prisma Client. */
export class PrismaFaqEntryRepository implements FaqEntryRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(incluirInativas: boolean): Promise<FaqEntry[]> {
    return this.client.faqEntry.findMany({
      where: incluirInativas ? undefined : { ativo: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findById(id: string): Promise<FaqEntry | null> {
    return this.client.faqEntry.findUnique({ where: { id } });
  }

  async create(dados: CriarFaqEntryDados): Promise<FaqEntry> {
    return this.client.faqEntry.create({
      data: {
        pergunta: dados.pergunta,
        resposta: dados.resposta,
        tags: dados.tags ?? null,
        ativo: dados.ativo ?? true,
      },
    });
  }

  async update(id: string, dados: AtualizarFaqEntryDados): Promise<FaqEntry> {
    return this.client.faqEntry.update({
      where: { id },
      data: dados,
    });
  }
}
