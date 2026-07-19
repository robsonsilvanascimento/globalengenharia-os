import type { ContaReceber, StatusContaReceber } from './ContaReceber';

export interface CriarContaReceberDados {
  numero: string;
  clienteId: string;
  contratoId?: string | null;
  descricao: string;
  valor: number;
  vencimentoEm: Date;
  observacao?: string | null;
  criadoPorId?: string | null;
}

export interface FiltroContasReceber {
  status?: StatusContaReceber;
  clienteId?: string;
  contratoId?: string;
  vencimentoInicio?: Date;
  vencimentoFim?: Date;
}

export interface BaixaContaReceber {
  pagoEm: Date;
  valorPago: number;
  formaPagamento?: string | null;
}

export interface ContaReceberComCliente extends ContaReceber {
  clienteNome: string;
}

export interface ContaReceberRepository {
  criar(dados: CriarContaReceberDados): Promise<ContaReceber>;
  buscarPorId(id: string): Promise<ContaReceber | null>;
  listar(filtro: FiltroContasReceber): Promise<ContaReceberComCliente[]>;
  baixar(id: string, dados: BaixaContaReceber): Promise<ContaReceber>;
  atualizarStatus(id: string, status: StatusContaReceber): Promise<ContaReceber>;
  /** Quantidade de contas criadas no ano, para gerar o numero sequencial. */
  contarNoAno(ano: number): Promise<number>;
  /** Marca como 'vencida' todas as contas 'aberta' com vencimento anterior a `referencia`. Retorna quantas mudaram. */
  marcarVencidasAntesDe(referencia: Date): Promise<number>;
  /** Ja existe conta para este contrato com este vencimento? (idempotencia do faturamento) */
  existeParaContratoNoVencimento(contratoId: string, vencimentoEm: Date): Promise<boolean>;
}
