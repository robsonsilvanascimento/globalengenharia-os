import type { PrismaClient } from '@prisma/client';
import type { BuscarOSParaRastreio, OSParaRastreio } from '../application/ports';

export class PrismaBuscarOSParaRastreio implements BuscarOSParaRastreio {
  constructor(private readonly client: PrismaClient) {}

  async buscar(id: string): Promise<OSParaRastreio | null> {
    const os = await this.client.ordemServico.findUnique({
      where: { id },
      select: { id: true, numero: true, tecnicoId: true, clienteId: true, latitude: true, longitude: true },
    });
    return os ?? null;
  }
}
