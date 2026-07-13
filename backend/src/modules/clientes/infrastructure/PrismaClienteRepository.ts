import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { Cliente } from '../domain/Cliente';
import type { ClienteRepository, CriarClienteDados } from '../domain/ClienteRepository';

/** Implementacao de ClienteRepository sobre o Prisma Client. */
export class PrismaClienteRepository implements ClienteRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(): Promise<Cliente[]> {
    return this.client.cliente.findMany({ orderBy: { criadoEm: 'desc' } });
  }

  async findById(id: string): Promise<Cliente | null> {
    return this.client.cliente.findUnique({ where: { id } });
  }

  async findByTelefone(telefone: string): Promise<Cliente | null> {
    return this.client.cliente.findUnique({ where: { telefoneWhatsapp: telefone } });
  }

  async create(dados: CriarClienteDados): Promise<Cliente> {
    return this.client.cliente.create({
      data: {
        nome: dados.nome,
        telefoneWhatsapp: dados.telefoneWhatsapp,
        documento: dados.documento,
        email: dados.email,
      },
    });
  }

  async update(
    id: string,
    dados: Partial<{ nome: string; email: string }>,
  ): Promise<Cliente> {
    return this.client.cliente.update({
      where: { id },
      data: dados,
    });
  }
}
