import type { Periodicidade } from './periodicidade';

export interface ContratoRecorrente {
  id: string;
  clienteId: string;
  descricao: string;
  valor: number;
  periodicidade: Periodicidade;
  proximaCobrancaEm: Date;
  dataInicio: Date;
  dataFim: Date | null;
  ativo: boolean;
  criadoPorId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}
