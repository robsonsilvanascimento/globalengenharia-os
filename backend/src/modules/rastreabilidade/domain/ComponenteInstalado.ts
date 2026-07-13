export interface ComponenteInstalado {
  id: string;
  ordemServicoId: string;
  nome: string;
  fabricante?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  codigoBarras?: string | null;
  garantiaMeses?: number | null;
  garantiaExpiraEm?: Date | null;
  observacoes?: string | null;
  criadoPorUsuarioId?: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CriarComponenteInstaladoInput {
  ordemServicoId: string;
  nome: string;
  fabricante?: string;
  modelo?: string;
  numeroSerie?: string;
  codigoBarras?: string;
  garantiaMeses?: number;
  observacoes?: string;
  criadoPorUsuarioId?: string;
}
