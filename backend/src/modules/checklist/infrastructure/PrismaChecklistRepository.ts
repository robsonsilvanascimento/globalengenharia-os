import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { ChecklistRepository } from '../domain/ChecklistRepository';
import type {
  CriarTemplateInput,
  ItemChecklist,
  RespostaChecklist,
  ResponderChecklistInput,
  TemplateChecklist,
} from '../domain/Checklist';

export class PrismaChecklistRepository implements ChecklistRepository {
  constructor(private readonly client: PrismaClient) {}

  async createTemplate(input: CriarTemplateInput): Promise<TemplateChecklist> {
    const row = await this.client.templateChecklist.create({
      data: {
        id: randomUUID(),
        categoriaServicoId: input.categoriaServicoId,
        titulo: input.titulo,
        ativo: true,
        itens: {
          createMany: {
            data: input.itens.map((item) => ({
              id: randomUUID(),
              descricao: item.descricao,
              ordem: item.ordem,
            })),
          },
        },
      },
      include: { itens: true },
    });

    return this.templateToEntity(row);
  }

  async findTemplateByCategoriaServico(categoriaServicoId: string): Promise<TemplateChecklist | null> {
    const row = await this.client.templateChecklist.findFirst({
      where: { categoriaServicoId, ativo: true },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });

    return row ? this.templateToEntity(row) : null;
  }

  async listTemplates(): Promise<TemplateChecklist[]> {
    const rows = await this.client.templateChecklist.findMany({
      where: { ativo: true },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });

    return rows.map((r) => this.templateToEntity(r));
  }

  async upsertRespostas(input: ResponderChecklistInput): Promise<RespostaChecklist[]> {
    const results = await Promise.all(
      input.respostas.map((resposta) =>
        this.client.respostaChecklist.upsert({
          where: {
            ordemServicoId_itemId: {
              ordemServicoId: input.ordemServicoId,
              itemId: resposta.itemId,
            },
          },
          create: {
            id: randomUUID(),
            ordemServicoId: input.ordemServicoId,
            itemId: resposta.itemId,
            marcado: resposta.marcado,
            respondidoPorId: input.respondidoPorId ?? null,
            respondidoEm: new Date(),
          },
          update: {
            marcado: resposta.marcado,
            respondidoPorId: input.respondidoPorId ?? null,
            respondidoEm: new Date(),
          },
        }),
      ),
    );

    return results.map((r) => this.respostaToEntity(r));
  }

  async findRespostasByOrdemServico(ordemServicoId: string): Promise<RespostaChecklist[]> {
    const rows = await this.client.respostaChecklist.findMany({
      where: { ordemServicoId },
    });

    return rows.map((r) => this.respostaToEntity(r));
  }

  private templateToEntity(row: {
    id: string;
    categoriaServicoId: string;
    titulo: string;
    ativo: boolean;
    criadoEm: Date;
    itens: Array<{ id: string; templateId: string; descricao: string; ordem: number }>;
  }): TemplateChecklist {
    return {
      id: row.id,
      categoriaServicoId: row.categoriaServicoId,
      titulo: row.titulo,
      ativo: row.ativo,
      criadoEm: row.criadoEm,
      itens: row.itens.map((item) => this.itemToEntity(item)),
    };
  }

  private itemToEntity(row: {
    id: string;
    templateId: string;
    descricao: string;
    ordem: number;
  }): ItemChecklist {
    return {
      id: row.id,
      templateId: row.templateId,
      descricao: row.descricao,
      ordem: row.ordem,
    };
  }

  private respostaToEntity(row: {
    id: string;
    ordemServicoId: string;
    itemId: string;
    marcado: boolean;
    respondidoPorId: string | null;
    respondidoEm: Date;
  }): RespostaChecklist {
    return {
      id: row.id,
      ordemServicoId: row.ordemServicoId,
      itemId: row.itemId,
      marcado: row.marcado,
      respondidoPorId: row.respondidoPorId,
      respondidoEm: row.respondidoEm,
    };
  }
}
