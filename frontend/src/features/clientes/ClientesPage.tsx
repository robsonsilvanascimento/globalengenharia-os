import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useClientesQuery } from './useClientesQuery';
import type { Cliente } from '../../types/api';
import { httpClient } from '../../lib/api/httpClient';
import './ClientesPage.css';

const columns: TableColumn<Cliente>[] = [
  { key: 'nome', header: 'Nome' },
  { key: 'telefone_whatsapp', header: 'Telefone' },
  { key: 'email', header: 'E-mail', render: (cliente) => cliente.email ?? '—' },
];

const FORM_VAZIO = { nome: '', telefone_whatsapp: '', email: '', documento: '' };

export function ClientesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clientesQuery = useClientesQuery();

  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);

  const criarCliente = useMutation({
    mutationFn: (body: typeof FORM_VAZIO) =>
      httpClient.post<Cliente>('/clientes', {
        nome: body.nome,
        telefone_whatsapp: body.telefone_whatsapp,
        email: body.email || undefined,
        documento: body.documento || undefined,
      }),
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      setModalAberto(false);
      setForm(FORM_VAZIO);
      navigate(`/clientes/${novo.id}`);
    },
    onError: () => setErro('Erro ao cadastrar cliente. Verifique os dados.'),
  });

  function abrirModal() {
    setForm(FORM_VAZIO);
    setErro(null);
    setModalAberto(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim() || !form.telefone_whatsapp.trim()) {
      setErro('Nome e telefone são obrigatórios.');
      return;
    }
    criarCliente.mutate(form);
  }

  return (
    <div className="clientes-page">
      <div className="clientes-page-header">
        <h1 className="clientes-page-title">Clientes</h1>
        <button type="button" className="clientes-btn-novo" onClick={abrirModal}>
          + Novo Cliente
        </button>
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

      {modalAberto && (
        <div className="clientes-modal-overlay" onClick={() => setModalAberto(false)}>
          <div className="clientes-modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Novo Cliente</h2>
            <form onSubmit={handleSubmit} className="clientes-modal-form">
              <label>
                Nome *
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo ou razão social"
                />
              </label>
              <label>
                Telefone (WhatsApp) *
                <input
                  required
                  value={form.telefone_whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, telefone_whatsapp: e.target.value }))}
                  placeholder="5511999999999"
                />
              </label>
              <label>
                E-mail
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </label>
              <label>
                CPF / CNPJ
                <input
                  value={form.documento}
                  onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              {erro && <p className="clientes-modal-erro">{erro}</p>}
              <div className="clientes-modal-acoes">
                <button type="button" className="clientes-btn-cancelar" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="clientes-btn-salvar" disabled={criarCliente.isPending}>
                  {criarCliente.isPending ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
