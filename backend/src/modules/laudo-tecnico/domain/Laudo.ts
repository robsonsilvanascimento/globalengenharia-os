export interface Laudo {
  id: string;
  numero: string;
  ordemServicoId: string | null;
  titulo: string;
  subtitulo: string | null;
  tipo: string;
  clienteNome: string | null;
  normasAplicaveis: string | null;
  conteudo: string;
  responsavelNome: string | null;
  responsavelCrea: string | null;
  artNumero: string | null;
  emitidoEm: Date;
  criadoPorId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface SalvarLaudoInput {
  /** Presente quando e edicao de um laudo ja existente. */
  id?: string;
  ordemServicoId?: string | null;
  titulo: string;
  subtitulo?: string | null;
  tipo: string;
  clienteNome?: string | null;
  normasAplicaveis?: string | null;
  conteudo: string;
  responsavelNome?: string | null;
  responsavelCrea?: string | null;
  artNumero?: string | null;
  criadoPorId?: string;
}
