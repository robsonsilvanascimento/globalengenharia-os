import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Select } from '../../../components/ui/Select';
import { useConsumoPecas, useAdicionarConsumoPeca, useRemoverConsumoPeca } from '../hooks/useConsumoPecas';
import { usePecas } from '../hooks/useEstoque';
import type { Peca } from '../../../types/api';

interface ConsumoPecasSectionProps {
  osId: string;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function ConsumoPecasSection({ osId }: ConsumoPecasSectionProps) {
  const { papel } = useAuth();
  const isAdmin = papel === 'admin';
  const canAdd = papel === 'admin' || papel === 'tecnico';

  const consumoQuery = useConsumoPecas(osId);
  const pecasQuery = usePecas({ ativo: true });
  const adicionarMutation = useAdicionarConsumoPeca(osId);
  const removerMutation = useRemoverConsumoPeca(osId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPecaId, setSelectedPecaId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [precoUnitario, setPrecoUnitario] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  function handlePecaChange(pecaId: string) {
    setSelectedPecaId(pecaId);
    const peca = pecasQuery.data?.find((p: Peca) => p.id === pecaId);
    if (peca) {
      setPrecoUnitario(String(peca.preco_unitario));
    } else {
      setPrecoUnitario('');
    }
  }

  function handleOpenModal() {
    setSelectedPecaId('');
    setQuantidade('1');
    setPrecoUnitario('');
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleConfirmar() {
    const qtd = Number(quantidade);
    const preco = Number(precoUnitario.replace(',', '.'));
    if (!selectedPecaId) {
      setModalError('Selecione uma peça.');
      return;
    }
    if (!qtd || qtd < 1) {
      setModalError('Quantidade deve ser no mínimo 1.');
      return;
    }
    if (Number.isNaN(preco) || preco < 0) {
      setModalError('Informe um preço unitário válido.');
      return;
    }
    adicionarMutation.mutate(
      { peca_id: selectedPecaId, quantidade: qtd, preco_unitario: preco },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setModalError(null);
        },
        onError: () => {
          setModalError('Erro ao adicionar peça. Tente novamente.');
        },
      },
    );
  }

  function handleRemover(consumoId: string) {
    if (window.confirm('Remover esta peça da OS?')) {
      removerMutation.mutate(consumoId);
    }
  }

  return (
    <section className="os-detail-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="os-detail-section-title">Peças Utilizadas</h2>
        {canAdd && (
          <button type="button" className="os-detail-button os-detail-button-primary" onClick={handleOpenModal}>
            + Adicionar Peça
          </button>
        )}
      </div>

      {consumoQuery.isLoading && <LoadingState message="Carregando peças..." />}
      {consumoQuery.isError && (
        <ErrorState message="Erro ao carregar peças." onRetry={() => consumoQuery.refetch()} />
      )}

      {consumoQuery.data && (
        <>
          {consumoQuery.data.consumos.length === 0 ? (
            <p className="os-detail-no-transition">Nenhuma peça registrada para esta OS.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.5rem' }}>Código</th>
                  <th style={{ padding: '0.5rem' }}>Nome</th>
                  <th style={{ padding: '0.5rem' }}>Qtd</th>
                  <th style={{ padding: '0.5rem' }}>Preço Unit.</th>
                  <th style={{ padding: '0.5rem' }}>Subtotal</th>
                  {isAdmin && <th style={{ padding: '0.5rem' }}>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {consumoQuery.data.consumos.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem' }}>{c.peca?.codigo ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{c.peca?.nome ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{c.quantidade}</td>
                    <td style={{ padding: '0.5rem' }}>{currencyFormatter.format(c.preco_unitario)}</td>
                    <td style={{ padding: '0.5rem' }}>{currencyFormatter.format(c.subtotal)}</td>
                    {isAdmin && (
                      <td style={{ padding: '0.5rem' }}>
                        <button
                          type="button"
                          className="os-detail-button os-detail-button-danger"
                          onClick={() => handleRemover(c.id)}
                          disabled={removerMutation.isPending && removerMutation.variables === c.id}
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p style={{ textAlign: 'right', fontWeight: 700, marginTop: '0.75rem' }}>
            Total em peças: {currencyFormatter.format(consumoQuery.data.custo_total)}
          </p>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Adicionar Peça">
        <div className="os-detail-assign-modal">
          <FormField label="Peça" htmlFor="peca-select">
            <Select
              value={selectedPecaId}
              onChange={handlePecaChange}
              placeholder="Selecione uma peça"
              options={(pecasQuery.data ?? []).map((p: Peca) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))}
            />
          </FormField>
          <FormField label="Quantidade" htmlFor="consumo-quantidade">
            <input
              id="consumo-quantidade"
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </FormField>
          <FormField label="Preço Unitário (R$)" htmlFor="consumo-preco">
            <input
              id="consumo-preco"
              type="number"
              min="0"
              step="0.01"
              value={precoUnitario}
              onChange={(e) => setPrecoUnitario(e.target.value)}
            />
          </FormField>
          {modalError && <p className="os-detail-error">{modalError}</p>}
          <button
            type="button"
            className="os-detail-button os-detail-button-primary"
            onClick={handleConfirmar}
            disabled={adicionarMutation.isPending}
          >
            {adicionarMutation.isPending ? 'Adicionando...' : 'Confirmar'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
