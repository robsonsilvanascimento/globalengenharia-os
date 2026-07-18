export interface TrechoNormativo {
  id: string;
  norma: string;
  item: string | null;
  categoria: string;
  assunto: string;
  texto: string;
  itemVerificar: boolean;
  ativo: boolean;
  criadoPorId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CriarTrechoInput {
  norma: string;
  item?: string | null;
  categoria: string;
  assunto: string;
  texto: string;
  itemVerificar?: boolean;
  criadoPorId?: string;
}

export interface AtualizarTrechoInput {
  norma?: string;
  item?: string | null;
  categoria?: string;
  assunto?: string;
  texto?: string;
  itemVerificar?: boolean;
  ativo?: boolean;
}

export interface ListarTrechosFiltro {
  categoria?: string;
  norma?: string;
  busca?: string;
}
