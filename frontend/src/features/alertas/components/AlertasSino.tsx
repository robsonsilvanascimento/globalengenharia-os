import { useState } from 'react';
import { useAlertasGarantia } from '../hooks/useAlertasGarantia';
import { useMarcarAlertaLido } from '../hooks/useMarcarAlertaLido';
import type { AlertaGarantia } from '../../../types/alerta';

export function AlertasSino() {
  const [open, setOpen] = useState(false);
  const { data: alertas = [] } = useAlertasGarantia({ lido: false });
  const { mutate: marcarLido } = useMarcarAlertaLido();

  const total = alertas.length;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Alertas de garantia"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 22,
          position: 'relative',
          padding: '4px 6px',
          lineHeight: 1,
        }}
      >
        🔔
        {total > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: '#e53e3e',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: '50%',
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              lineHeight: 1,
            }}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 320,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              fontWeight: 600,
              fontSize: 13,
              borderBottom: '1px solid #e2e8f0',
              color: '#1a202c',
            }}
          >
            Alertas de garantia
          </div>

          {total === 0 ? (
            <div style={{ padding: '16px 14px', color: '#718096', fontSize: 13 }}>
              Nenhum alerta pendente
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
              {alertas.map((alerta: AlertaGarantia) => (
                <li
                  key={alerta.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid #f0f4f8',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: '#2d3748',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alerta.componente_nome}
                    </div>
                    <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
                      {alerta.dias_restantes} dia{alerta.dias_restantes !== 1 ? 's' : ''} restante
                      {alerta.os_numero && (
                        <span> · OS {alerta.os_numero}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => marcarLido(alerta.id)}
                    aria-label="Marcar como lido"
                    style={{
                      background: '#ebf8ff',
                      border: '1px solid #bee3f8',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: '#2b6cb0',
                      fontWeight: 700,
                      fontSize: 14,
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    ✓
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
