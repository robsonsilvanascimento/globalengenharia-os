export type TipoDocumentoOS =
  | 'certificado_garantia'
  | 'manual'
  | 'laudo_tecnico'
  | 'nota_fiscal'
  | 'foto'
  | 'outro';

export interface DocumentoOS {
  id: string;
  ordemServicoId: string;
  componenteInstaladoId?: string | null;
  nome: string;
  tipoDocumento: TipoDocumentoOS;
  caminhoArmazenamento: string;
  mimeType: string;
  tamanhoBytes: number;
  ativo: boolean;
  carregadoPorUsuarioId?: string | null;
  criadoEm: Date;
}

export interface AdicionarDocumentoOSInput {
  ordemServicoId: string;
  componenteInstaladoId?: string;
  nome: string;
  tipoDocumento: TipoDocumentoOS;
  caminhoArmazenamento: string;
  mimeType: string;
  tamanhoBytes: number;
  carregadoPorUsuarioId?: string;
}
