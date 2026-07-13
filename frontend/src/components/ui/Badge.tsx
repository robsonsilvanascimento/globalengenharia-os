import './Badge.css';

export type OsStatus =
  | 'aberta'
  | 'triagem'
  | 'atribuida'
  | 'em_andamento'
  | 'aguardando_peca'
  | 'concluida'
  | 'cancelada';

export type OsArea = 'eletrica' | 'automacao' | 'energia_solar' | 'outro';

export interface BadgeProps {
  variant: 'status' | 'area';
  value: OsStatus | OsArea | string;
}

const STATUS_MAP: Record<OsStatus, { label: string; className: string }> = {
  aberta: { label: 'Aberta', className: 'ui-badge-blue' },
  triagem: { label: 'Triagem', className: 'ui-badge-yellow' },
  atribuida: { label: 'Atribuída', className: 'ui-badge-purple' },
  em_andamento: { label: 'Em andamento', className: 'ui-badge-orange' },
  aguardando_peca: { label: 'Aguardando peça', className: 'ui-badge-gray' },
  concluida: { label: 'Concluída', className: 'ui-badge-green' },
  cancelada: { label: 'Cancelada', className: 'ui-badge-red' },
};

const AREA_MAP: Record<OsArea, { label: string; className: string }> = {
  eletrica: { label: 'Elétrica', className: 'ui-badge-cyan' },
  automacao: { label: 'Automação', className: 'ui-badge-indigo' },
  energia_solar: { label: 'Energia Solar', className: 'ui-badge-amber' },
  outro: { label: 'Outro', className: 'ui-badge-slate' },
};

export function Badge({ variant, value }: BadgeProps) {
  const entry =
    variant === 'status'
      ? STATUS_MAP[value as OsStatus]
      : AREA_MAP[value as OsArea];

  if (!entry) {
    return <span className="ui-badge ui-badge-slate">{value}</span>;
  }

  return <span className={`ui-badge ${entry.className}`}>{entry.label}</span>;
}
