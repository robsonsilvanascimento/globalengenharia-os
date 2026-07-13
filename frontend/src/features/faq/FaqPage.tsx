import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { httpClient } from '../../lib/api/httpClient';
import type { FaqEntry } from '../../types/api';
import { FAQ_QUERY_KEY, useFaqQuery } from './useFaqQuery';
import { FaqForm } from './FaqForm';
import './FaqPage.css';

const PERGUNTA_MAX_LENGTH = 80;

function truncarPergunta(pergunta: string): string {
  if (pergunta.length <= PERGUNTA_MAX_LENGTH) {
    return pergunta;
  }
  return `${pergunta.slice(0, PERGUNTA_MAX_LENGTH).trimEnd()}...`;
}

export function FaqPage() {
  const { data, isLoading, isError, refetch } = useFaqQuery();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      httpClient.patch<FaqEntry>(`/faq/${id}`, { ativo }),
    onMutate: async ({ id, ativo }) => {
      await queryClient.cancelQueries({ queryKey: FAQ_QUERY_KEY });
      const previous = queryClient.getQueryData<FaqEntry[]>(FAQ_QUERY_KEY);

      queryClient.setQueryData<FaqEntry[]>(FAQ_QUERY_KEY, (current) =>
        current?.map((entrada) => (entrada.id === id ? { ...entrada, ativo } : entrada)),
      );

      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FAQ_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FAQ_QUERY_KEY });
    },
  });

  const columns: TableColumn<FaqEntry>[] = [
    {
      key: 'pergunta',
      header: 'Pergunta',
      render: (entrada) => <span title={entrada.pergunta}>{truncarPergunta(entrada.pergunta)}</span>,
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (entrada) => entrada.tags ?? '—',
    },
    {
      key: 'ativo',
      header: 'Ativo',
      render: (entrada) => (
        <button
          type="button"
          className={`faq-toggle ${entrada.ativo ? 'is-active' : 'is-inactive'}`}
          onClick={() => toggleAtivoMutation.mutate({ id: entrada.id, ativo: !entrada.ativo })}
          disabled={toggleAtivoMutation.isPending}
        >
          {entrada.ativo ? 'Ativo' : 'Inativo'}
        </button>
      ),
    },
  ];

  function handleFormSuccess(): void {
    setIsModalOpen(false);
  }

  return (
    <div className="faq-page">
      <div className="faq-header">
        <h1 className="faq-title">Base de conhecimento (FAQ)</h1>
        <button type="button" className="faq-new-button" onClick={() => setIsModalOpen(true)}>
          Nova pergunta
        </button>
      </div>

      {isLoading && <LoadingState message="Carregando perguntas..." />}
      {isError && <ErrorState message="Não foi possível carregar o FAQ." onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <Table
          columns={columns}
          rows={data ?? []}
          rowKey={(entrada) => entrada.id}
          emptyMessage="Nenhuma pergunta cadastrada."
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova pergunta">
        <FaqForm onSuccess={handleFormSuccess} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
}
