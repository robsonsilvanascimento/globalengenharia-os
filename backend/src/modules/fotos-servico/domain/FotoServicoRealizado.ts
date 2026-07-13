export interface FotoServicoRealizado {
  id: string;
  ordemServicoId: string;
  mimeType: string;
  base64: string;
  legenda: string | null;
  enviadoPorId: string | null;
  enviadoPorNome: string | null;
  criadoEm: Date;
}

export interface AdicionarFotoServicoInput {
  ordemServicoId: string;
  mimeType: string;
  base64: string;
  legenda?: string;
  enviadoPorId: string | null;
}
