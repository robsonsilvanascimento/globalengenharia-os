import { BadRequestError } from '../../../shared/http/errors/AppError';
import type { ContaReceber } from '../domain/ContaReceber';
import type { ContaReceberRepository } from '../domain/ContaReceberRepository';
import { montarNumeroConta } from '../domain/numeroConta';

export interface CriarContaReceberInput {
  clienteId: string;
  descricao: string;
  valor: number;
  vencimentoEm: Date;
  observacao?: string | null;
  criadoPorId?: string | null;
  contratoId?: string | null;
}

export class CriarContaReceberUseCase {
  constructor(private readonly deps: { contaReceberRepository: ContaReceberRepository }) {}

  async execute(input: CriarContaReceberInput): Promise<ContaReceber> {
    if (!input.descricao.trim()) throw new BadRequestError('Informe a descricao da conta');
    if (!(input.valor > 0)) throw new BadRequestError('O valor deve ser maior que zero');
    if (Number.isNaN(input.vencimentoEm.getTime())) throw new BadRequestError('Vencimento invalido');

    const { contaReceberRepository } = this.deps;
    const ano = new Date().getFullYear();
    const sequencial = (await contaReceberRepository.contarNoAno(ano)) + 1;

    return contaReceberRepository.criar({
      numero: montarNumeroConta(ano, sequencial),
      clienteId: input.clienteId,
      contratoId: input.contratoId ?? null,
      descricao: input.descricao.trim(),
      valor: input.valor,
      vencimentoEm: input.vencimentoEm,
      observacao: input.observacao?.trim() || null,
      criadoPorId: input.criadoPorId ?? null,
    });
  }
}
