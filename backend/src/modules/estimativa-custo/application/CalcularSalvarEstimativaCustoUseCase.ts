import type { EstimativaCustoOS } from '../domain/EstimativaCustoOS';
import type { EstimativaCustoOSRepository } from '../domain/EstimativaCustoOSRepository';

export interface CalcularSalvarEstimativaCustoInput {
  ordemServicoId: string;
  horasEstimadasTecnico: number;
  valorHoraTecnico: number;
  horasEstimadasAjudante?: number;
  valorHoraAjudante?: number;
  custoCombustivel: number;
  custoPedagio: number;
  custoDesgasteVeiculo: number;
  custoAlmoco?: number;
  custoJanta?: number;
  custoEstadia?: number;
  turno?: 'diurno' | 'noturno';
  custoAdicionalNoturno?: number;
  outrosCustos: number;
  criadoPorUsuarioId: string;
}

export interface CalcularSalvarEstimativaCustoDeps {
  estimativaCustoOSRepository: EstimativaCustoOSRepository;
}

/**
 * Calcula o custo total estimado de uma OS (mao de obra tecnico/ajudante +
 * custos operacionais) e persiste via upsert (uma unica estimativa por OS).
 *
 * Os valores de valor/hora sao um snapshot passado pelo chamador (controller)
 * — este caso de uso nao busca o valor/hora atual do usuario, apenas calcula
 * e persiste com os valores recebidos.
 */
export class CalcularSalvarEstimativaCustoUseCase {
  constructor(private readonly deps: CalcularSalvarEstimativaCustoDeps) {}

  async execute(input: CalcularSalvarEstimativaCustoInput): Promise<EstimativaCustoOS> {
    const { estimativaCustoOSRepository } = this.deps;

    const custoMaoDeObraTecnico = input.horasEstimadasTecnico * input.valorHoraTecnico;
    const custoMaoDeObraAjudante = (input.horasEstimadasAjudante ?? 0) * (input.valorHoraAjudante ?? 0);
    const custoAlmoco = input.custoAlmoco ?? 0;
    const custoJanta = input.custoJanta ?? 0;
    const custoEstadia = input.custoEstadia ?? 0;
    const turno = input.turno ?? 'diurno';
    const custoAdicionalNoturno = input.custoAdicionalNoturno ?? 0;

    const custoTotal =
      custoMaoDeObraTecnico +
      custoMaoDeObraAjudante +
      input.custoCombustivel +
      input.custoPedagio +
      input.custoDesgasteVeiculo +
      custoAlmoco +
      custoJanta +
      custoEstadia +
      input.outrosCustos +
      (turno === 'noturno' ? custoAdicionalNoturno : 0);

    return estimativaCustoOSRepository.upsert(input.ordemServicoId, {
      horasEstimadasTecnico: input.horasEstimadasTecnico,
      valorHoraTecnico: input.valorHoraTecnico,
      horasEstimadasAjudante: input.horasEstimadasAjudante,
      valorHoraAjudante: input.valorHoraAjudante,
      custoCombustivel: input.custoCombustivel,
      custoPedagio: input.custoPedagio,
      custoDesgasteVeiculo: input.custoDesgasteVeiculo,
      custoAlmoco,
      custoJanta,
      custoEstadia,
      turno,
      custoAdicionalNoturno,
      outrosCustos: input.outrosCustos,
      custoTotal,
      criadoPorUsuarioId: input.criadoPorUsuarioId,
    });
  }
}
