import { useNavigate } from 'react-router-dom';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useClientesQuery } from './useClientesQuery';
import type { Cliente } from '../../types/api';
import './ClientesPage.css';

const columns: TableColumn<Cliente>[] = [
  { key: 'nome', header: 'Nome' },
  { key: 'telefone_whatsapp', header: 'Telefone' },
  { key: 'email', header: 'E-mail', render: (cliente) => cliente.email ?? '—' },
];

/** List page for clientes; clicking a row navigates to the cliente's detail page. */
export function ClientesPage() {
  const navigate = useNavigate();
  const clientesQuery = useClientesQuery();

  return (
    <div className="clientes-page">
      <div className="clientes-page-header">
        <h1 className="clientes-page-title">Clientes</h1>
      </div>

      {clientesQuery.isLoading ? (
        <LoadingState message="Carregando clientes..." />
      ) : clientesQuery.isError ? (
        <ErrorState message="Não foi possível carregar os clientes." onRetry={() => clientesQuery.refetch()} />
      ) : (
        <Table
          columns={columns}
          rows={clientesQuery.data ?? []}
          rowKey={(cliente) => cliente.id}
          onRowClick={(cliente) => navigate(`/clientes/${cliente.id}`)}
          emptyMessage="Nenhum cliente cadastrado."
        />
      )}
    </div>
  );
}
