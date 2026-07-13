import type { HistoricoStatusOS, Usuario } from '../../types/api';
import { STATUS_LABELS } from '../../features/ordens-servico/statusTransitions';
import './Timeline.css';

export interface TimelineProps {
  historico: HistoricoStatusOS[];
  usuarios?: Usuario[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

/** Renders the chronological (oldest -> newest) status history of an OS. */
export function Timeline({ historico, usuarios = [] }: TimelineProps) {
  if (historico.length === 0) {
    return <p className="os-timeline-empty">Nenhuma alteração de status registrada ainda.</p>;
  }

  const itensOrdenados = [...historico].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  );

  function nomeAutor(item: HistoricoStatusOS): string {
    if (item.alterado_por_bot) {
      return 'Automação (bot)';
    }
    const usuario = usuarios.find((candidate) => candidate.id === item.alterado_por_usuario_id);
    return usuario?.nome ?? 'Usuário desconhecido';
  }

  return (
    <ol className="os-timeline">
      {itensOrdenados.map((item) => (
        <li key={item.id} className="os-timeline-item">
          <span className="os-timeline-dot" aria-hidden="true" />
          <div className="os-timeline-content">
            <div className="os-timeline-transition">
              <span>{STATUS_LABELS[item.status_anterior]}</span>
              <span className="os-timeline-arrow" aria-hidden="true">
                →
              </span>
              <span>{STATUS_LABELS[item.status_novo]}</span>
            </div>
            <div className="os-timeline-meta">
              <span>{nomeAutor(item)}</span>
              <span className="os-timeline-meta-separator">•</span>
              <span>{formatDateTime(item.criado_em)}</span>
            </div>
            {item.observacao && <p className="os-timeline-observacao">{item.observacao}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
