import { BadRequestError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { ContaReceber } from '../domain/ContaReceber';
import type { ContaReceberRepository } from '../domain/ContaReceberRepository';

/** Cancela uma conta a receber que ainda nao foi paga. */
export class CancelarContaReceberUseCase {
  constructor(private readonly deps: { contaReceberRepository: ContaReceberRepository }) {}

  async execute(id: string): Promise<ContaReceber> {
    const conta = await this.deps.contaReceberRepository.buscarPorId(id);
    if (!conta) throw new NotFoundError('Conta a receber nao encontrada');
    if (conta.status === 'paga') throw new BadRequestError('Conta paga nao pode ser cancelada');
    if (conta.status === 'cancelada') return conta;
    return this.deps.contaReceberRepository.atualizarStatus(id, 'cancelada');
  }
}
