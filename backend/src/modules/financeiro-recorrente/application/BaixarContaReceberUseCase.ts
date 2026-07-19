import { BadRequestError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { ContaReceber } from '../domain/ContaReceber';
import type { ContaReceberRepository } from '../domain/ContaReceberRepository';

export interface BaixarContaReceberInput {
  id: string;
  valorPago?: number;
  formaPagamento?: string | null;
  pagoEm?: Date;
}

/** Da baixa (marca como paga) numa conta a receber em aberto/vencida. */
export class BaixarContaReceberUseCase {
  constructor(private readonly deps: { contaReceberRepository: ContaReceberRepository }) {}

  async execute(input: BaixarContaReceberInput): Promise<ContaReceber> {
    const conta = await this.deps.contaReceberRepository.buscarPorId(input.id);
    if (!conta) throw new NotFoundError('Conta a receber nao encontrada');
    if (conta.status === 'paga') throw new BadRequestError('Conta ja esta paga');
    if (conta.status === 'cancelada') throw new BadRequestError('Conta cancelada nao pode receber baixa');

    const valorPago = input.valorPago ?? conta.valor;
    if (!(valorPago > 0)) throw new BadRequestError('O valor pago deve ser maior que zero');

    return this.deps.contaReceberRepository.baixar(input.id, {
      pagoEm: input.pagoEm ?? new Date(),
      valorPago,
      formaPagamento: input.formaPagamento?.trim() || null,
    });
  }
}
