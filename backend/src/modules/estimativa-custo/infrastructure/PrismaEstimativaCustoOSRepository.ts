import type { EstimativaCustoOS as EstimativaCustoOSPrisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { EstimativaCustoOS } from '../domain/EstimativaCustoOS';
import type {
  EstimativaCustoOSRepository,
  UpsertEstimativaCustoOSDados,
} from '../domain/EstimativaCustoOSRepository';

/** Converte o registro do Prisma (Decimal) para a entidade de dominio (number). */
function paraEntidade(registro: EstimativaCustoOSPrisma): EstimativaCustoOS {
  return {
    id: registro.id,
    ordemServicoId: registro.ordemServicoId,
    horasEstimadasTecnico: Number(registro.horasEstimadasTecnico),
    valorHoraTecnico: Number(registro.valorHoraTecnico),
    horasEstimadasAjudante:
      registro.horasEstimadasAjudante !== null ? Number(registro.horasEstimadasAjudante) : undefined,
    valorHoraAjudante: registro.valorHoraAjudante !== null ? Number(registro.valorHoraAjudante) : undefined,
    custoCombustivel: Number(registro.custoCombustivel),
    custoPedagio: Number(registro.custoPedagio),
    custoDesgasteVeiculo: Number(registro.custoDesgasteVeiculo),
    custoAlmoco: Number(registro.custoAlmoco),
    custoJanta: Number(registro.custoJanta),
    custoEstadia: Number(registro.custoEstadia),
    turno: registro.turno,
    custoAdicionalNoturno: Number(registro.custoAdicionalNoturno),
    outrosCustos: Number(registro.outrosCustos),
    custoTotal: Number(registro.custoTotal),
    criadoPorUsuarioId: registro.criadoPorUsuarioId,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

/** Implementacao de EstimativaCustoOSRepository sobre o Prisma Client. */
export class PrismaEstimativaCustoOSRepository implements EstimativaCustoOSRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findByOrdemServicoId(ordemServicoId: string): Promise<EstimativaCustoOS | null> {
    const registro = await this.client.estimativaCustoOS.findUnique({ where: { ordemServicoId } });
    return registro ? paraEntidade(registro) : null;
  }

  async upsert(ordemServicoId: string, dados: UpsertEstimativaCustoOSDados): Promise<EstimativaCustoOS> {
    const registro = await this.client.estimativaCustoOS.upsert({
      where: { ordemServicoId },
      create: {
        ordemServicoId,
        horasEstimadasTecnico: dados.horasEstimadasTecnico,
        valorHoraTecnico: dados.valorHoraTecnico,
        horasEstimadasAjudante: dados.horasEstimadasAjudante,
        valorHoraAjudante: dados.valorHoraAjudante,
        custoCombustivel: dados.custoCombustivel,
        custoPedagio: dados.custoPedagio,
        custoDesgasteVeiculo: dados.custoDesgasteVeiculo,
        custoAlmoco: dados.custoAlmoco,
        custoJanta: dados.custoJanta,
        custoEstadia: dados.custoEstadia,
        turno: dados.turno,
        custoAdicionalNoturno: dados.custoAdicionalNoturno,
        outrosCustos: dados.outrosCustos,
        custoTotal: dados.custoTotal,
        criadoPorUsuarioId: dados.criadoPorUsuarioId,
      },
      update: {
        horasEstimadasTecnico: dados.horasEstimadasTecnico,
        valorHoraTecnico: dados.valorHoraTecnico,
        horasEstimadasAjudante: dados.horasEstimadasAjudante,
        valorHoraAjudante: dados.valorHoraAjudante,
        custoCombustivel: dados.custoCombustivel,
        custoPedagio: dados.custoPedagio,
        custoDesgasteVeiculo: dados.custoDesgasteVeiculo,
        custoAlmoco: dados.custoAlmoco,
        custoJanta: dados.custoJanta,
        custoEstadia: dados.custoEstadia,
        turno: dados.turno,
        custoAdicionalNoturno: dados.custoAdicionalNoturno,
        outrosCustos: dados.outrosCustos,
        custoTotal: dados.custoTotal,
        criadoPorUsuarioId: dados.criadoPorUsuarioId,
      },
    });
    return paraEntidade(registro);
  }
}
