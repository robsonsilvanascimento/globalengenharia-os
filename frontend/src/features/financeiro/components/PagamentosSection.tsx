import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { usePagamentosOS, useGerarPix, useRegistrarPagamentoManual } from '../hooks/useFinanceiro';
import type { PagamentoOS, StatusPagamento } from '../../../types/api';

interface PagamentosSectionProps {
  osId: string;
  valorCobrado?: number | null;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

const TIPO_LABELS: Record<PagamentoOS['tipo'], string> = {
  pix_automatico: 'Pix',
  manual: 'Manual',
};

const STATUS_LABELS: Record<StatusPagamento, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

function deriveStatusGeral(pagamentos: PagamentoOS[]): 'pago' | 'parcial' | 'pendente' {
  const pagos = pagamentos.filter((p) => p.status_pagamento === 'pago');
  if (pagos.length === 0) return 'pendente';
  if (pagos.length === pagamentos.length) return 'pago';
  return 'parcial';
}

export function PagamentosSection({ osId, valorCobrado }: PagamentosSectionProps) {
  const { papel } = useAuth();
  const isAdmin = papel === 'admin';

  const pagamentosQuery = usePagamentosOS(osId);
  const gerarPixMutation = useGerarPix(osId);
  const registrarManualMutation = useRegistrarPagamentoManual(osId);

  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixGerado, setPixGerado] = useState<PagamentoOS | null>(null);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualValor, setManualValor] = useState('');
  const [manualObs, setManualObs] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const pagamentos = pagamentosQuery.data ?? [];
  const statusGeral = pagamentos.length > 0 ? deriveStatusGeral(pagamentos) : 'pendente';

  function handleGerarPix() {
    gerarPixMutation.mutate(undefined, {
      onSuccess: (pag) => {
        setPixGerado(pag);
        setPixModalOpen(true);
      },
    });
  }

  function handleAbrirManual() {
    setManualValor(valorCobrado != null ? String(valorCobrado) : '');
    setManualObs('');
    setManualError(null);
    setManualModalOpen(true);
  }

  function handleConfirmarManual() {
    const valor = Number(manualValor.replace(',', '.'));
    if (!manualValor || Number.isNaN(valor) || valor <= 0) {
      setManualError('Informe um valor válido.');
      return;
    }
    registrarManualMutation.mutate(
      { valor, observacao: manualObs.trim() || undefined },
      {
        onSuccess: () => {
          setManualModalOpen(false);
          setManualValor('');
          setManualObs('');
          setManualError(null);
        },
        onError: () => setManualError('Erro ao registrar pagamento.'),
      },
    );
  }

  function handleCopiar(text: string) {
    void navigator.clipboard.writeText(text);
  }

  const statusBadgeClass =
    statusGeral === 'pago'
      ? 'pagamentos-badge pagamentos-badge-pago'
      : statusGeral === 'parcial'
        ? 'pagamentos-badge pagamentos-badge-parcial'
        : 'pagamentos-badge pagamentos-badge-pendente';

  const statusBadgeLabel =
    statusGeral === 'pago' ? 'Pago' : statusGeral === 'parcial' ? 'Parcialmente pago' : 'Pendente';

  return (
    <section className="os-detail-card">
      <div className="pagamentos-header">
        <h2 className="os-detail-section-title">Pagamentos</h2>
        <span className={statusBadgeClass}>{statusBadgeLabel}</span>
      </div>

      {pagamentosQuery.isLoading && <LoadingState message="Carregando pagamentos..." />}
      {pagamentosQuery.isError && (
        <ErrorState message="Não foi possível carregar os pagamentos." onRetry={() => pagamentosQuery.refetch()} />
      )}

      {!pagamentosQuery.isLoading && !pagamentosQuery.isError && pagamentos.length === 0 && (
        <p className="os-detail-no-transition">Nenhum pagamento registrado.</p>
      )}

      {pagamentos.length > 0 && (
        <ul className="pagamentos-list">
          {pagamentos.map((pag) => (
            <li key={pag.id} className="pagamentos-item">
              <span className="pagamentos-tipo">{TIPO_LABELS[pag.tipo]}</span>
              <span className="pagamentos-valor">{currencyFormatter.format(pag.valor)}</span>
              <span className="pagamentos-status">{STATUS_LABELS[pag.status_pagamento]}</span>
              {pag.pago_em && <span className="pagamentos-data">Pago em {formatDate(pag.pago_em)}</span>}
              {pag.pix_copia_e_cola && (
                <button
                  type="button"
                  className="os-detail-button os-detail-button-outline"
                  onClick={() => handleCopiar(pag.pix_copia_e_cola!)}
                >
                  Copiar chave Pix
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="pagamentos-actions">
          <button
            type="button"
            className="os-detail-button os-detail-button-primary"
            onClick={handleGerarPix}
            disabled={gerarPixMutation.isPending}
          >
            {gerarPixMutation.isPending ? 'Gerando...' : 'Gerar Pix'}
          </button>
          <button
            type="button"
            className="os-detail-button"
            onClick={handleAbrirManual}
          >
            Registrar Pagamento Manual
          </button>
        </div>
      )}

      <Modal isOpen={pixModalOpen} onClose={() => setPixModalOpen(false)} title="QR Code Pix">
        {pixGerado && (
          <div className="pagamentos-pix-modal">
            {pixGerado.pix_qr_code && (
              <img
                src={`data:image/png;base64,${pixGerado.pix_qr_code}`}
                alt="QR Code Pix"
                className="pagamentos-pix-qr"
              />
            )}
            {pixGerado.pix_copia_e_cola && (
              <button
                type="button"
                className="os-detail-button os-detail-button-primary"
                onClick={() => handleCopiar(pixGerado.pix_copia_e_cola!)}
              >
                Copiar chave Pix
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={manualModalOpen} onClose={() => setManualModalOpen(false)} title="Registrar Pagamento Manual">
        <div className="os-detail-assign-modal">
          <FormField label="Valor (R$)" htmlFor="manual-valor" error={manualError ?? undefined}>
            <input
              id="manual-valor"
              type="number"
              min="0"
              step="0.01"
              value={manualValor}
              onChange={(e) => setManualValor(e.target.value)}
            />
          </FormField>
          <FormField label="Observação (opcional)" htmlFor="manual-obs">
            <input
              id="manual-obs"
              type="text"
              value={manualObs}
              onChange={(e) => setManualObs(e.target.value)}
            />
          </FormField>
          <button
            type="button"
            className="os-detail-button os-detail-button-primary"
            onClick={handleConfirmarManual}
            disabled={registrarManualMutation.isPending}
          >
            {registrarManualMutation.isPending ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
