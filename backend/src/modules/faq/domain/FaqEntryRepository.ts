import type { FaqEntry } from './FaqEntry';

/** Dados necessarios para criar uma FaqEntry. `id`, `criadoEm` e `atualizadoEm` sao gerados pela implementacao. */
export interface CriarFaqEntryDados {
  pergunta: string;
  resposta: string;
  tags?: string | null;
  ativo?: boolean;
}

/** Dados parciais aceitos em uma atualizacao de FaqEntry. */
export interface AtualizarFaqEntryDados {
  pergunta?: string;
  resposta?: string;
  tags?: string | null;
  ativo?: boolean;
}

/**
 * Contrato de persistencia para FaqEntry. Nenhum detalhe de Prisma/SQL
 * vaza aqui — a implementacao concreta (repositorio Prisma) fica em infrastructure/.
 */
export interface FaqEntryRepository {
  /** Lista entradas da FAQ. Quando `incluirInativas` for false, retorna somente as ativas. */
  list(incluirInativas: boolean): Promise<FaqEntry[]>;
  findById(id: string): Promise<FaqEntry | null>;
  create(dados: CriarFaqEntryDados): Promise<FaqEntry>;
  update(id: string, dados: AtualizarFaqEntryDados): Promise<FaqEntry>;
}
