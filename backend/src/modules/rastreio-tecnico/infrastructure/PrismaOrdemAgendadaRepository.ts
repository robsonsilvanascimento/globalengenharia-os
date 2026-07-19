import type { PrismaClient } from '@prisma/client';
import type { OrdemAgendada, OrdemAgendadaRepository } from '../domain/OrdemAgendadaRepository';

export class PrismaOrdemAgendadaRepository implements OrdemAgendadaRepository {
  constructor(private readonly client: PrismaClient) {}

  async listarDoDia(tecnicoId: string, inicioDoDia: Date, fimDoDia: Date): Promise<OrdemAgendada[]> {
    const ordens = await this.client.ordemServico.findMany({
      where: {
        tecnicoId,
        status: { not: 'cancelada' },
        dataAgendada: { gte: inicioDoDia, lt: fimDoDia },
      },
      include: { cliente: { select: { nome: true } } },
      orderBy: { dataAgendada: 'asc' },
    });

    return ordens.map((o) => ({
      id: o.id,
      numero: o.numero,
      clienteNome: o.cliente.nome,
      enderecoAtendimento: o.enderecoAtendimento,
      latitude: o.latitude,
      longitude: o.longitude,
      dataAgendada: o.dataAgendada,
      status: o.status,
    }));
  }

  async definirCoordenadas(ordemServicoId: string, latitude: number, longitude: number): Promise<void> {
    await this.client.ordemServico.update({
      where: { id: ordemServicoId },
      data: { latitude, longitude },
    });
  }
}
