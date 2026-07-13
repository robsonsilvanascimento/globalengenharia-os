import type { MidiaOrdemServico, TipoMidia } from './MidiaOrdemServico';

/** Dados necessarios para criar uma MidiaOrdemServico. `id` e `criadoEm` sao gerados pela implementacao. */
export interface CriarMidiaOrdemServicoDados {
  ordemServicoId?: string;
  clienteId: string;
  tipo: TipoMidia;
  caminhoArmazenamento: string;
  mimeType: string;
  tamanhoBytes: number;
  whatsappMediaId?: string;
}

/**
 * Contrato de persistencia para MidiaOrdemServico. Nenhum detalhe de
 * Prisma/SQL vaza aqui — a implementacao concreta (repositorio Prisma) fica
 * em infrastructure/.
 */
export interface MidiaOrdemServicoRepository {
  create(dados: CriarMidiaOrdemServicoDados): Promise<MidiaOrdemServico>;
  findById(id: string): Promise<MidiaOrdemServico | null>;
  listByOrdemServicoId(ordemServicoId: string): Promise<MidiaOrdemServico[]>;
  delete(id: string): Promise<void>;
}
