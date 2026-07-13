import { useState } from 'react';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Select } from '../../../components/ui/Select';
import { useManutencoesPreventivasVencendo, useRegistrarRealizada } from '../hooks/useManutencaoPreventiva';
import type { ManutencaoPreventivaComDetalhe } from '../../../types/api';

const DIAS_OPTIONS = [
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
];

function diasRestantes(proxima_em: string): number {
  const diff = new Date(proxima_em).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DiasRestantesBadge({ dias }: { dias: number }) {
  let background = '#16a34a';
  if (dias < 15) background = '#dc2626';
  else if (dias <= 30) background = '#ca8a04';

  return (
    <span
      style={{
        background,
        color: '#fff',
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >
      {dias} dia{dias !== 1 ? 's' : ''}
    </span>
  );
}

function RegistrarRealizadaButton({ id, onSuccess }: { id: string; onSuccess: () => void }) {
  const mutation = useRegistrarRealizada(id);
  return (
    <button
      type="button"
      className="os-detail-button os-detail-button-primary"
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(undefined, { onSuccess })
      }
      style={{ fontSize: '0.8rem', padding: '4px 10px' }}
    >
      {mutation.isPending ? 'Registrando...' : 'Registrar Realizada'}
    </button>
  );
}

export default function ManutencaoPage() {
  const [dias, setDias] = useState('30');
  const query = useManutencoesPreventivasVencendo(Number(dias));

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Manutenção Preventiva</h1>

      <div style={{ marginBottom: '1rem', maxWidth: '200px' }}>
        <Select
          value={dias}
          onChange={setDias}
          options={DIAS_OPTIONS}
          placeholder="Vencendo em..."
        />
      </div>

      {query.isLoading && <LoadingState message="Carregando manutenções..." />}
      {query.isError && (
        <ErrorState message="Erro ao carregar manutenções." onRetry={() => query.refetch()} />
      )}

      {query.data && query.data.length === 0 && (
        <p>Nenhuma manutenção preventiva vencendo nos próximos {dias} dias.</p>
      )}

      {query.data && query.data.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem' }}>Componente</th>
              <th style={{ padding: '0.5rem' }}>Cliente</th>
              <th style={{ padding: '0.5rem' }}>OS</th>
              <th style={{ padding: '0.5rem' }}>Próxima Em</th>
              <th style={{ padding: '0.5rem' }}>Dias Restantes</th>
              <th style={{ padding: '0.5rem' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((m: ManutencaoPreventivaComDetalhe) => {
              const dias_rest = diasRestantes(m.proxima_em);
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem' }}>{m.componente_instalado?.nome ?? '—'}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {m.componente_instalado?.ordem_servico?.cliente?.nome ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {m.componente_instalado?.ordem_servico?.numero ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {new Date(m.proxima_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <DiasRestantesBadge dias={dias_rest} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <RegistrarRealizadaButton id={m.id} onSuccess={() => query.refetch()} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
