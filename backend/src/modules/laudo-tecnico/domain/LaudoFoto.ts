export interface LaudoFoto {
  id: string;
  laudoId: string;
  chaveArquivo: string;
  mimeType: string;
  legenda: string | null;
  ordem: number;
  criadoEm: Date;
}
