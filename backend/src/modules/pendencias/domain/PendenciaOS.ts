export interface FotoPendencia {
  id: string;
  pendenciaId: string;
  mimeType: string;
  base64: string;
  criadoEm: Date;
}

export interface PendenciaOS {
  id: string;
  ordemServicoId: string;
  observacao: string;
  criadoPorId: string | null;
  criadoEm: Date;
  fotos: FotoPendencia[];
}

export interface RegistrarPendenciaInput {
  ordemServicoId: string;
  observacao: string;
  criadoPorId: string | null;
  fotos: Array<{ mimeType: string; base64: string }>;
}
