import type { ContratoRecorrente } from './ContratoRecorrente';
import type { Periodicidade } from './periodicidade';

export interface CriarContratoDados {
  clienteId: string;
  descricao: string;
  valor: number;
  periodicidade: Periodicidade;
  proximaCobrancaEm: Date;
  dataInicio: Date;
  dataFim?: Date | null;
  criadoPorId?: string | null;
}

export interface ContratoComCliente extends ContratoRecorrente {
  clienteNome: string;
}

export interface ContratoRecorrenteRepository {
  criar(dados: CriarContratoDados): Promise<ContratoRecorrente>;
  buscarPorId(id: string): Promise<ContratoRecorrente | null>;
  listar(filtro: { ativo?: boolean; clienteId?: string }): Promise<ContratoComCliente[]>;
  definirAtivo(id: string, ativo: boolean): Promise<ContratoRecorrente>;
  atualizarProximaCobranca(id: string, proximaCobrancaEm: Date): Promise<ContratoRecorrente>;
  /** Contratos ativos com cobranca vencida (proximaCobrancaEm <= referencia). */
  listarVencendoAte(referencia: Date): Promise<ContratoRecorrente[]>;
}
