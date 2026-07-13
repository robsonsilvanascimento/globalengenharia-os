import { ClienteNaoEncontradoError } from '../domain/errors/ClienteNaoEncontradoError';
import type { ClienteRepository } from '../domain/ClienteRepository';
import type { CategoriaServicoRepository } from '../../categorias-servico/domain/CategoriaServicoRepository';
import type { PrioridadeOS, StatusOS } from '../../ordens-servico/domain/OrdemServico';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';

/** Quantidade de itens buscada de uma vez para trazer "todas as OS" do cliente, sem paginacao. */
const PAGE_SIZE_SEM_PAGINACAO = 10_000;

export interface OrdemServicoResumoItem {
  id: string;
  numero: string;
  categoriaNome: string;
  descricaoProblema: string;
  status: StatusOS;
  prioridade: PrioridadeOS;
  valorCobrado: number | null;
  criadoEm: Date;
}

export interface ResumoCliente {
  totalOrdensServico: number;
  totalValorCobrado: number;
  ordensServico: OrdemServicoResumoItem[];
}

export interface ObterResumoClienteDeps {
  clienteRepository: ClienteRepository;
  ordemServicoRepository: OrdemServicoRepository;
  categoriaServicoRepository: CategoriaServicoRepository;
}

/**
 * Monta o resumo de um cliente: total de OS, soma do valor cobrado e o
 * historico de servicos ja realizados (mais recente primeiro), usado para
 * popular o painel do cliente. Lanca ClienteNaoEncontradoError se o cliente
 * nao existir.
 */
export class ObterResumoClienteUseCase {
  constructor(private readonly deps: ObterResumoClienteDeps) {}

  async execute(clienteId: string): Promise<ResumoCliente> {
    const cliente = await this.deps.clienteRepository.findById(clienteId);
    if (!cliente) {
      throw new ClienteNaoEncontradoError(clienteId);
    }

    const [{ itens }, categorias] = await Promise.all([
      this.deps.ordemServicoRepository.list(
        { clienteId },
        { page: 1, pageSize: PAGE_SIZE_SEM_PAGINACAO },
      ),
      this.deps.categoriaServicoRepository.list(true),
    ]);

    const nomeCategoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));

    const ordensOrdenadas = [...itens].sort(
      (a, b) => b.criadoEm.getTime() - a.criadoEm.getTime(),
    );

    const totalValorCobrado = ordensOrdenadas.reduce(
      (soma, ordemServico) => soma + (ordemServico.valorCobrado ?? 0),
      0,
    );

    return {
      totalOrdensServico: ordensOrdenadas.length,
      totalValorCobrado,
      ordensServico: ordensOrdenadas.map((ordemServico) => ({
        id: ordemServico.id,
        numero: ordemServico.numero,
        categoriaNome: nomeCategoriaPorId.get(ordemServico.categoriaServicoId) ?? '',
        descricaoProblema: ordemServico.descricaoProblema,
        status: ordemServico.status,
        prioridade: ordemServico.prioridade,
        valorCobrado: ordemServico.valorCobrado ?? null,
        criadoEm: ordemServico.criadoEm,
      })),
    };
  }
}
