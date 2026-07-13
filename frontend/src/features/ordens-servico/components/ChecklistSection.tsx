import { useState } from 'react';
import { LoadingState } from '../../../components/ui/LoadingState';
import { useChecklist, useResponderChecklist } from '../hooks/useChecklist';
import type { RespostaChecklist } from '../../../types/api';

interface Props {
  osId: string;
}

export function ChecklistSection({ osId }: Props) {
  const { data: checklist, isLoading, isError } = useChecklist(osId);
  const responder = useResponderChecklist(osId);

  const [respostas, setRespostas] = useState<RespostaChecklist[]>([]);

  const itens = checklist?.template?.itens ?? [];
  function getMarcado(itemId: string): boolean {
    const override = respostas.find((r) => r.item_id === itemId);
    if (override) return override.marcado;
    return checklist?.respostas.find((r) => r.item_id === itemId)?.marcado ?? false;
  }

  function handleToggle(itemId: string) {
    const novoMarcado = !getMarcado(itemId);

    const novasRespostas = itens.map((item) => ({
      item_id: item.id,
      marcado: item.id === itemId ? novoMarcado : getMarcado(item.id),
    }));

    setRespostas(novasRespostas);
    responder.mutate(novasRespostas);
  }

  const totalMarcados = itens.filter((item) => getMarcado(item.id)).length;

  if (isLoading) return (
    <section className="os-detail-card">
      <h2 className="os-detail-section-title">Checklist</h2>
      <LoadingState message="Carregando checklist..." />
    </section>
  );

  if (isError) return (
    <section className="os-detail-card">
      <h2 className="os-detail-section-title">Checklist</h2>
      <p className="os-detail-error">Erro ao carregar checklist</p>
    </section>
  );

  return (
    <section className="os-detail-card">
      <h2 className="os-detail-section-title">
        Checklist
        {checklist?.template && (
          <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 400, color: '#6b7280' }}>
            {totalMarcados} de {itens.length} itens concluídos
          </span>
        )}
      </h2>

      {!checklist?.template || itens.length === 0 ? (
        <p className="os-detail-no-transition">Nenhum checklist disponível para esta categoria</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {itens.map((item) => (
            <li
              key={item.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}
            >
              <input
                type="checkbox"
                id={`checklist-item-${item.id}`}
                checked={getMarcado(item.id)}
                onChange={() => handleToggle(item.id)}
                disabled={responder.isPending}
                style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
              />
              <label
                htmlFor={`checklist-item-${item.id}`}
                style={{ cursor: 'pointer', fontSize: 14, color: getMarcado(item.id) ? '#9ca3af' : '#111827', textDecoration: getMarcado(item.id) ? 'line-through' : 'none' }}
              >
                {item.descricao}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
