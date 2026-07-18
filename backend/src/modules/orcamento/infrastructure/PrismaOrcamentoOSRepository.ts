import type { OrcamentoOS as OrcamentoPrisma, Prisma, PrismaClient } from '@prisma/client';
import type { ItemOrcamento, OrcamentoOS, StatusOrcamento } from '../domain/OrcamentoOS';
import type { OrcamentoOSRepository, SalvarOrcamentoDados } from '../domain/OrcamentoOSRepository';

function paraStatus(valor: string): StatusOrcamento {
  return valor === 'aprovado' || valor === 'recusado' ? valor : 'pendente';
}

function paraItens(valor: Prisma.JsonValue): ItemOrcamento[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item): item is { descricao: string; valor: number } =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).descricao === 'string' &&
      typeof (item as Record<string, unknown>).valor === 'number',
    )
    .map((item) => ({ descricao: item.descricao, valor: item.valor }));
}

function paraEntidade(registro: OrcamentoPrisma): OrcamentoOS {
  return {
    id: registro.id,
    ordemServicoId: registro.ordemServicoId,
    status: paraStatus(registro.status),
    valorTotal: Number(registro.valorTotal),
    itens: paraItens(registro.itens),
    observacao: registro.observacao,
    tokenAprovacao: registro.tokenAprovacao,
    enviadoEm: registro.enviadoEm,
    respondidoEm: registro.respondidoEm,
    criadoPorId: registro.criadoPorId,
    criadoEm: registro.criadoEm,
    atualizadoEm: registro.atualizadoEm,
  };
}

export class PrismaOrcamentoOSRepository implements OrcamentoOSRepository {
  constructor(private readonly client: PrismaClient) {}

  async salvar(dados: SalvarOrcamentoDados): Promise<OrcamentoOS> {
    const itensJson = dados.itens as unknown as Prisma.InputJsonValue;
    const registro = await this.client.orcamentoOS.upsert({
      where: { ordemServicoId: dados.ordemServicoId },
      create: {
        ordemServicoId: dados.ordemServicoId,
        status: 'pendente',
        valorTotal: dados.valorTotal,
        itens: itensJson,
        observacao: dados.observacao ?? null,
        tokenAprovacao: dados.tokenAprovacao,
        criadoPorId: dados.criadoPorId,
      },
      update: {
        status: 'pendente',
        valorTotal: dados.valorTotal,
        itens: itensJson,
        observacao: dados.observacao ?? null,
        tokenAprovacao: dados.tokenAprovacao,
        criadoPorId: dados.criadoPorId,
        enviadoEm: null,
        respondidoEm: null,
      },
    });
    return paraEntidade(registro);
  }

  async buscarPorOrdemServico(ordemServicoId: string): Promise<OrcamentoOS | null> {
    const registro = await this.client.orcamentoOS.findUnique({ where: { ordemServicoId } });
    return registro ? paraEntidade(registro) : null;
  }

  async buscarPorToken(tokenAprovacao: string): Promise<OrcamentoOS | null> {
    const registro = await this.client.orcamentoOS.findUnique({ where: { tokenAprovacao } });
    return registro ? paraEntidade(registro) : null;
  }

  async marcarEnviado(id: string, enviadoEm: Date): Promise<OrcamentoOS> {
    const registro = await this.client.orcamentoOS.update({ where: { id }, data: { enviadoEm } });
    return paraEntidade(registro);
  }

  async registrarResposta(id: string, status: StatusOrcamento, respondidoEm: Date): Promise<OrcamentoOS> {
    const registro = await this.client.orcamentoOS.update({
      where: { id },
      data: { status, respondidoEm },
    });
    return paraEntidade(registro);
  }
}
