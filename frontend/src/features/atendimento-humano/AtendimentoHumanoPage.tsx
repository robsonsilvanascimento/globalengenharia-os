import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table } from '../../components/ui/Table';
import type { TableColumn } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { httpClient, ApiError } from '../../lib/api/httpClient';
import type { SolicitacaoAtendimento } from '../../types/api';
import {
  SOLICITACOES_ATENDIMENTO_PENDENTES_QUERY_KEY,
  useSolicitacoesAtendimentoQuery,
} from './useSolicitacoesAtendimentoQuery';
import './AtendimentoHumanoPage.css';

function formatDataHora(criadoEm: string): string {
  const data = new Date(criadoEm);
  return Number.isNaN(data.getTime()) ? '-' : data.toLocaleString('pt-BR');
}

function truncar(texto: string, tamanho = 80): string {
  return texto.length > tamanho ? `${texto.slice(0, tamanho)}...` : texto;
}

/**
 * Lists pending human-support requests (questions the WhatsApp bot could
 * not answer) and lets atendente/admin users answer them, optionally
 * saving the answer to the FAQ knowledge base.
 */
export function AtendimentoHumanoPage() {
  const queryClient = useQueryClient();
  const solicitacoesQuery = useSolicitacoesAtendimentoQuery();

  const [selecionada, setSelecionada] = useState<SolicitacaoAtendimento | null>(null);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [salvarComoFaq, setSalvarComoFaq] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const responderMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { resposta_texto: string; salvar_como_faq?: boolean } }) =>
      httpClient.patch<SolicitacaoAtendimento>(`/solicitacoes-atendimento/${id}/responder`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOLICITACOES_ATENDIMENTO_PENDENTES_QUERY_KEY });
      fecharModal();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar a resposta.');
    },
  });

  function abrirModal(solicitacao: SolicitacaoAtendimento): void {
    setSelecionada(solicitacao);
    setRespostaTexto('');
    setSalvarComoFaq(false);
    setError(null);
  }

  function fecharModal(): void {
    setSelecionada(null);
    setRespostaTexto('');
    setSalvarComoFaq(false);
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    if (!selecionada) {
      return;
    }
    if (!respostaTexto.trim()) {
      setError('Informe o texto da resposta.');
      return;
    }

    responderMutation.mutate({
      id: selecionada.id,
      body: { resposta_texto: respostaTexto.trim(), salvar_como_faq: salvarComoFaq },
    });
  }

  const columns: TableColumn<SolicitacaoAtendimento>[] = [
    { key: 'cliente_nome', header: 'Cliente' },
    { key: 'mensagem_cliente', header: 'Pergunta', render: (item) => truncar(item.mensagem_cliente) },
    { key: 'criado_em', header: 'Data', render: (item) => formatDataHora(item.criado_em) },
  ];

  return (
    <div className="atendimento-humano-page">
      <div className="atendimento-humano-header">
        <h1>Atendimento Humano</h1>
      </div>

      {solicitacoesQuery.isLoading ? (
        <LoadingState message="Carregando solicitações..." />
      ) : solicitacoesQuery.isError ? (
        <ErrorState
          message="Não foi possível carregar as solicitações de atendimento."
          onRetry={() => solicitacoesQuery.refetch()}
        />
      ) : (
        <Table
          columns={columns}
          rows={solicitacoesQuery.data ?? []}
          rowKey={(item) => item.id}
          onRowClick={abrirModal}
          emptyMessage="Nenhuma solicitação pendente."
        />
      )}

      <Modal isOpen={selecionada !== null} onClose={fecharModal} title="Responder solicitação">
        {selecionada && (
          <form className="atendimento-humano-form" onSubmit={handleSubmit}>
            <div className="atendimento-humano-form-field">
              <span className="atendimento-humano-form-label">Cliente</span>
              <span>{selecionada.cliente_nome}</span>
            </div>

            <div className="atendimento-humano-form-field">
              <span className="atendimento-humano-form-label">Pergunta</span>
              <p className="atendimento-humano-form-mensagem">{selecionada.mensagem_cliente}</p>
            </div>

            <div className="atendimento-humano-form-field">
              <label className="atendimento-humano-form-label" htmlFor="resposta-texto">
                Resposta
              </label>
              <textarea
                id="resposta-texto"
                className="atendimento-humano-form-textarea"
                rows={5}
                value={respostaTexto}
                onChange={(event) => setRespostaTexto(event.target.value)}
                required
              />
            </div>

            <label className="atendimento-humano-form-checkbox">
              <input
                type="checkbox"
                checked={salvarComoFaq}
                onChange={(event) => setSalvarComoFaq(event.target.checked)}
              />
              Salvar esta resposta na base de conhecimento (FAQ)
            </label>

            {error && <span className="atendimento-humano-form-error">{error}</span>}

            <div className="atendimento-humano-form-actions">
              <button
                type="button"
                className="atendimento-humano-form-cancel"
                onClick={fecharModal}
                disabled={responderMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="atendimento-humano-form-submit"
                disabled={responderMutation.isPending}
              >
                {responderMutation.isPending ? 'Enviando...' : 'Enviar resposta'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
