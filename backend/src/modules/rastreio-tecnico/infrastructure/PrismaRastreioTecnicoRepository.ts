import type { PrismaClient, RastreioTecnicoOS as RastreioPrisma } from '@prisma/client';
import type { RastreioTecnicoOS, TipoRastreio } from '../domain/RastreioTecnicoOS';
import type { CriarRastreioDados, RastreioTecnicoRepository } from '../domain/RastreioTecnicoRepository';

function paraEntidade(r: RastreioPrisma): RastreioTecnicoOS {
  return {
    id: r.id,
    ordemServicoId: r.ordemServicoId,
    tecnicoId: r.tecnicoId,
    tipo: r.tipo as TipoRastreio,
    latitude: r.latitude,
    longitude: r.longitude,
    criadoEm: r.criadoEm,
  };
}

export class PrismaRastreioTecnicoRepository implements RastreioTecnicoRepository {
  constructor(private readonly client: PrismaClient) {}

  async criar(dados: CriarRastreioDados): Promise<RastreioTecnicoOS> {
    const registro = await this.client.rastreioTecnicoOS.create({
      data: {
        ordemServicoId: dados.ordemServicoId,
        tecnicoId: dados.tecnicoId,
        tipo: dados.tipo,
        latitude: dados.latitude ?? null,
        longitude: dados.longitude ?? null,
      },
    });
    return paraEntidade(registro);
  }

  async listarPorOrdemServico(ordemServicoId: string): Promise<RastreioTecnicoOS[]> {
    const registros = await this.client.rastreioTecnicoOS.findMany({
      where: { ordemServicoId },
      orderBy: { criadoEm: 'asc' },
    });
    return registros.map(paraEntidade);
  }

  async ultimaLocalizacaoDoTecnico(tecnicoId: string): Promise<{ latitude: number; longitude: number } | null> {
    const registro = await this.client.rastreioTecnicoOS.findFirst({
      where: { tecnicoId, latitude: { not: null }, longitude: { not: null } },
      orderBy: { criadoEm: 'desc' },
    });
    if (!registro || registro.latitude === null || registro.longitude === null) return null;
    return { latitude: registro.latitude, longitude: registro.longitude };
  }
}
