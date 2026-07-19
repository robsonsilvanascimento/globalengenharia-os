import { BadRequestError } from '../../../shared/http/errors/AppError';
import type { ContratoRecorrente } from '../domain/ContratoRecorrente';
import type { ContratoRecorrenteRepository } from '../domain/ContratoRecorrenteRepository';
import type { Periodicidade } from '../domain/periodicidade';
import { PERIODICIDADES } from '../domain/periodicidade';

export interface CriarContratoInput {
  clienteId: string;
  descricao: string;
  valor: number;
  periodicidade: Periodicidade;
  dataInicio: Date;
  dataFim?: Date | null;
  criadoPorId?: string | null;
}

export class CriarContratoUseCase {
  constructor(private readonly deps: { contratoRecorrenteRepository: ContratoRecorrenteRepository }) {}

  async execute(input: CriarContratoInput): Promise<ContratoRecorrente> {
    if (!input.descricao.trim()) throw new BadRequestError('Informe a descricao do contrato');
    if (!(input.valor > 0)) throw new BadRequestError('O valor deve ser maior que zero');
    if (!PERIODICIDADES.includes(input.periodicidade)) throw new BadRequestError('Periodicidade invalida');
    if (Number.isNaN(input.dataInicio.getTime())) throw new BadRequestError('Data de inicio invalida');
    if (input.dataFim && input.dataFim.getTime() < input.dataInicio.getTime()) {
      throw new BadRequestError('A data de termino nao pode ser anterior ao inicio');
    }

    // A primeira cobranca vence na data de inicio.
    return this.deps.contratoRecorrenteRepository.criar({
      clienteId: input.clienteId,
      descricao: input.descricao.trim(),
      valor: input.valor,
      periodicidade: input.periodicidade,
      proximaCobrancaEm: input.dataInicio,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim ?? null,
      criadoPorId: input.criadoPorId ?? null,
    });
  }
}
