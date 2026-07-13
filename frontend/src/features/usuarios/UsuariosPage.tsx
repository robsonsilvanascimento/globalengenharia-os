import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { httpClient } from '../../lib/api/httpClient';
import type { Usuario } from '../../types/api';
import { UsuarioForm } from './UsuarioForm';
import './UsuariosPage.css';

const PAPEL_LABELS: Record<Usuario['papel'], string> = {
  atendente: 'Atendente',
  tecnico: 'Técnico',
  admin: 'Admin',
  ajudante: 'Ajudante',
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const columns: TableColumn<Usuario>[] = [
  { key: 'nome', header: 'Nome' },
  { key: 'email', header: 'Email' },
  { key: 'papel', header: 'Papel', render: (usuario) => PAPEL_LABELS[usuario.papel] },
  { key: 'telefone', header: 'Telefone', render: (usuario) => usuario.telefone || '—' },
  {
    key: 'valorHora',
    header: 'Valor/Hora',
    render: (usuario) =>
      usuario.valorHora !== undefined && usuario.valorHora !== null
        ? currencyFormatter.format(usuario.valorHora)
        : '—',
  },
  {
    key: 'ativo',
    header: 'Ativo',
    render: (usuario) => (
      <span className={usuario.ativo ? 'usuarios-page-status-ativo' : 'usuarios-page-status-inativo'}>
        {usuario.ativo ? 'Ativo' : 'Inativo'}
      </span>
    ),
  },
];

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => httpClient.get<Usuario[]>('/usuarios'),
  });

  function handleCreated(): void {
    setIsModalOpen(false);
    void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  }

  return (
    <div className="usuarios-page">
      <div className="usuarios-page-header">
        <h1 className="usuarios-page-title">Usuários</h1>
        <button type="button" className="usuarios-page-new-button" onClick={() => setIsModalOpen(true)}>
          Novo usuário
        </button>
      </div>

      {isLoading && <LoadingState message="Carregando usuários..." />}

      {isError && <ErrorState message="Não foi possível carregar os usuários." onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <Table
          columns={columns}
          rows={data ?? []}
          rowKey={(usuario) => usuario.id}
          emptyMessage="Nenhum usuário cadastrado."
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo usuário">
        <UsuarioForm onSuccess={handleCreated} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
}
