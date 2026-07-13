export interface AlertaGarantia {
  id: string;
  componente_id: string;
  componente_nome: string;
  dias_restantes: number;
  os_id: string | null;
  os_numero: string | null;
  lido: boolean;
  criado_em: string;
}
