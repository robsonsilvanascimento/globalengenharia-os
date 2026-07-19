export type StatusContaReceber = 'aberta' | 'paga' | 'vencida' | 'cancelada';

export interface ContaReceber {
  id: string;
  numero: string;
  clienteId: string;
  contratoId: string | null;
  descricao: string;
  valor: number;
  vencimentoEm: Date;
  status: StatusContaReceber;
  pagoEm: Date | null;
  valorPago: number | null;
  formaPagamento: string | null;
  observacao: string | null;
  criadoPorId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}
