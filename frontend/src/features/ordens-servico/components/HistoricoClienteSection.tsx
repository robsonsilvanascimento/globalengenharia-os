import { LoadingState } from '../../../components/ui/LoadingState';
import { Badge } from '../../../components/ui/Badge';
import { useHistoricoCliente } from '../hooks/useHistoricoCliente';

interface Props {
  clienteId: string;
}

export function HistoricoClienteSection({ clienteId }: Props) {
  const { data, isLoading, isError } = useHistoricoCliente(clienteId);

  const items = data?.items ?? [];

  return (
    <section className="os-detail-card">
      <h2 className="os-detail-section-title">Histórico do Cliente</h2>

      {isLoading && <LoadingState message="Carregando histórico..." />}
      {isError && <p className="os-detail-error">Erro ao carregar histórico do cliente</p>}

      {!isLoading && !isError && items.length === 0 && (
        <p className="os-detail-no-transition">Nenhuma OS anterior encontrada</p>
      )}

      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: '#374151' }}>Número</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Categoria</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Técnico</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151' }}>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px 8px 0', fontWeight: 500 }}>{item.numero}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <Badge variant="status" value={item.status} />
                  </td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{item.categoria_nome}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{item.tecnico_nome ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                    {new Date(item.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
