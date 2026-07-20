import { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useAlertasGarantia } from '../hooks/useAlertasGarantia';
import { useMarcarAlertaLido } from '../hooks/useMarcarAlertaLido';
import type { AlertaGarantia } from '../../../types/alerta';
import './AlertasSino.css';

export function AlertasSino() {
  const [open, setOpen] = useState(false);
  const { data: alertas = [] } = useAlertasGarantia({ lido: false });
  const { mutate: marcarLido } = useMarcarAlertaLido();

  const total = alertas.length;

  return (
    <div className="alertas-sino">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Alertas de garantia"
        className="alertas-sino-button"
      >
        <Bell size={20} />
        {total > 0 && <span className="alertas-sino-badge">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && (
        <div className="alertas-sino-painel">
          <div className="alertas-sino-painel-titulo">Alertas de garantia</div>

          {total === 0 ? (
            <div className="alertas-sino-vazio">Nenhum alerta pendente</div>
          ) : (
            <ul className="alertas-sino-lista">
              {alertas.map((alerta: AlertaGarantia) => (
                <li key={alerta.id} className="alertas-sino-item">
                  <div className="alertas-sino-item-info">
                    <div className="alertas-sino-item-nome">{alerta.componente_nome}</div>
                    <div className="alertas-sino-item-detalhe">
                      {alerta.dias_restantes} dia{alerta.dias_restantes !== 1 ? 's' : ''} restante
                      {alerta.os_numero && <span> · OS {alerta.os_numero}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => marcarLido(alerta.id)}
                    aria-label="Marcar como lido"
                    className="alertas-sino-marcar-lido"
                  >
                    <Check size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
