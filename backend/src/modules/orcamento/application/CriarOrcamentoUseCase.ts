import { randomBytes } from 'node:crypto';
import { BadRequestError, ConflictError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import { calcularValorTotal, type CriarOrcamentoInput, type OrcamentoOS } from '../domain/OrcamentoOS';
import type { OrcamentoOSRepository } from '../domain/OrcamentoOSRepository';

export interface CriarOrcamentoDeps {
  orcamentoRepository: OrcamentoOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export class CriarOrcamentoUseCase {
  constructor(private readonly deps: CriarOrcamentoDeps) {}

  async execute(input: CriarOrcamentoInput): Promise<OrcamentoOS> {
    const { orcamentoRepository, ordemServicoRepository } = this.deps;

    const os = await ordemServicoRepository.findById(input.ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    if (input.itens.length === 0) {
      throw new BadRequestError('Informe ao menos um item no orcamento');
    }
    for (const item of input.itens) {
      if (!item.descricao.trim()) {
        throw new BadRequestError('Todo item do orcamento precisa de uma descricao');
      }
      if (!(item.valor > 0)) {
        throw new BadRequestError('Todo item do orcamento precisa de um valor maior que zero');
      }
    }

    // Nao permite substituir um orcamento ja aprovado pelo cliente — isso
    // mudaria o preco de um acordo ja fechado sem rastro. Para alterar,
    // cancela-se a OS/orcamento por outro fluxo.
    const existente = await orcamentoRepository.buscarPorOrdemServico(input.ordemServicoId);
    if (existente && existente.status === 'aprovado') {
      throw new ConflictError('Ja existe um orcamento aprovado para esta OS');
    }

    const valorTotal = calcularValorTotal(input.itens);
    const tokenAprovacao = randomBytes(32).toString('hex');

    return orcamentoRepository.salvar({
      ordemServicoId: input.ordemServicoId,
      itens: input.itens,
      valorTotal,
      observacao: input.observacao,
      tokenAprovacao,
      criadoPorId: input.criadoPorId,
    });
  }
}
