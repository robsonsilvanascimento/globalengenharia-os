/** Momento do registro fotografico. `null` em fotos antigas (tratadas como "depois"). */
export type MomentoFoto = 'antes' | 'depois';

export interface FotoServicoRealizado {
  id: string;
  ordemServicoId: string;
  mimeType: string;
  base64: string;
  legenda: string | null;
  momento: MomentoFoto | null;
  enviadoPorId: string | null;
  enviadoPorNome: string | null;
  criadoEm: Date;
}

export interface AdicionarFotoServicoInput {
  ordemServicoId: string;
  mimeType: string;
  base64: string;
  legenda?: string;
  momento?: MomentoFoto;
  enviadoPorId: string | null;
}
