import { STATUS_ORDEM, useStatusCountsQuery } from './useStatusCountsQuery';
import { useCountUp } from './useCountUp';
import type { StatusOrdemServico } from '../../types/api';
import './StatusSummaryCards.css';

type IconName = 'folder' | 'search' | 'user-check' | 'settings' | 'package' | 'check-circle' | 'x-circle';

function StatusIcon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'user-check':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="4" />
          <path d="M2 21v-1a6 6 0 0 1 6-6h2" />
          <path d="m16 16 2 2 4-4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.55-1.03H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64a1.7 1.7 0 0 0 1.03-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9a1.7 1.7 0 0 0 1.55 1.03H21a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      );
    case 'package':
      return (
        <svg {...common}>
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
          <path d="M3.27 6.96 12 12l8.73-5.04" />
          <path d="M12 22.08V12" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 5-5" />
        </svg>
      );
    case 'x-circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m14.5 9.5-5 5" />
          <path d="m9.5 9.5 5 5" />
        </svg>
      );
    default:
      return null;
  }
}

const STATUS_INFO: Record<StatusOrdemServico, { label: string; cor: string; icon: IconName }> = {
  aberta: { label: 'Aberta', cor: 'blue', icon: 'folder' },
  triagem: { label: 'Triagem', cor: 'yellow', icon: 'search' },
  atribuida: { label: 'Atribuída', cor: 'purple', icon: 'user-check' },
  em_andamento: { label: 'Em andamento', cor: 'orange', icon: 'settings' },
  aguardando_peca: { label: 'Aguardando peça', cor: 'gray', icon: 'package' },
  concluida: { label: 'Concluída', cor: 'green', icon: 'check-circle' },
  cancelada: { label: 'Cancelada', cor: 'red', icon: 'x-circle' },
};

function StatusSummaryCard({
  status,
  count,
  isActive,
  isLoading,
  delay,
  onClick,
}: {
  status: StatusOrdemServico;
  count: number;
  isActive: boolean;
  isLoading: boolean;
  delay: number;
  onClick: () => void;
}) {
  const info = STATUS_INFO[status];
  const contadorAnimado = useCountUp(count);

  return (
    <button
      type="button"
      className={`status-summary-card status-summary-card-accent-${info.cor} ${isActive ? 'status-summary-card-active' : ''}`}
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <span className={`status-summary-card-icon-chip status-summary-card-icon-${info.cor}`}>
        <StatusIcon name={info.icon} />
      </span>
      <span className="status-summary-card-count">{isLoading ? '—' : contadorAnimado}</span>
      <span className="status-summary-card-label">{info.label}</span>
    </button>
  );
}

export interface StatusSummaryCardsProps {
  statusAtivo: string;
  onSelecionarStatus: (status: string) => void;
}

/** Cartões de resumo com a contagem de OS por status, no topo do dashboard. */
export function StatusSummaryCards({ statusAtivo, onSelecionarStatus }: StatusSummaryCardsProps) {
  const { counts, isLoading } = useStatusCountsQuery();

  return (
    <div className="status-summary-cards">
      {STATUS_ORDEM.map((status, index) => (
        <StatusSummaryCard
          key={status}
          status={status}
          count={counts[status]}
          isActive={statusAtivo === status}
          isLoading={isLoading}
          delay={index * 0.04}
          onClick={() => onSelecionarStatus(statusAtivo === status ? '' : status)}
        />
      ))}
    </div>
  );
}
