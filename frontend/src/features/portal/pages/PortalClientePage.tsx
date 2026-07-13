import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { usePortalOSList, usePortalOSDetalhe } from '../hooks/usePortalOS';
import { createPortalClient } from '../../../lib/api/portalClient';
import type { PortalOS } from '../../../types/api';
import './PortalClientePage.css';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : dateFormatter.format(d);
}

function formatValor(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return currencyFormatter.format(valor);
}

interface OSCardProps {
  os: PortalOS;
  token: string;
}

function OSCard({ os, token }: OSCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: detalhe, isLoading: loadingDetalhe } = usePortalOSDetalhe(
    token,
    expanded ? os.id : '',
  );

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const client = createPortalClient(token);
      const response = await client.get(`/portal/os/${os.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="portal-os-card">
      <div className="portal-os-card-header" onClick={() => setExpanded(e => !e)}>
        <div className="portal-os-card-info">
          <span className="portal-os-numero">OS #{os.numero}</span>
          <Badge variant="status" value={os.status} />
          <span className="portal-os-data">{formatDate(os.criado_em)}</span>
          {os.valor_cobrado !== undefined && os.valor_cobrado !== null && (
            <span className="portal-os-valor">{formatValor(os.valor_cobrado)}</span>
          )}
        </div>
        <div className="portal-os-actions" onClick={e => e.stopPropagation()}>
          <button
            className="portal-btn-pdf"
            onClick={handleDownloadPdf}
            disabled={downloading}
            type="button"
          >
            {downloading ? 'Aguarde...' : 'Baixar PDF'}
          </button>
        </div>
        <span className={`portal-chevron${expanded ? ' open' : ''}`}>&#9660;</span>
      </div>

      {expanded && (
        <div className="portal-os-card-body">
          <p className="portal-os-descricao">{os.descricao_problema}</p>

          {loadingDetalhe && <p className="portal-loading">Carregando detalhes...</p>}

          {detalhe && (
            <>
              {detalhe.historico_status.length > 0 && (
                <div>
                  <p className="portal-section-title">Histórico de status</p>
                  <div className="portal-historico-list">
                    {detalhe.historico_status.map(h => (
                      <div key={h.id} className="portal-historico-item">
                        <Badge variant="status" value={h.status_anterior} />
                        <span className="portal-historico-arrow">&#8594;</span>
                        <Badge variant="status" value={h.status_novo} />
                        {h.observacao && <span>— {h.observacao}</span>}
                        <span className="portal-historico-data">{formatDate(h.criado_em)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detalhe.fotos_servico.length > 0 && (
                <div>
                  <p className="portal-section-title">Fotos do serviço</p>
                  <div className="portal-fotos-grid">
                    {detalhe.fotos_servico.map(foto => (
                      <div key={foto.id} className="portal-foto-item">
                        <img
                          src={`data:${foto.mime_type};base64,${foto.base64}`}
                          alt={foto.legenda ?? 'Foto do serviço'}
                        />
                        {foto.legenda && (
                          <p className="portal-foto-legenda">{foto.legenda}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PortalClientePage() {
  const { token = '' } = useParams<{ token: string }>();
  const { data, isLoading, error } = usePortalOSList(token);

  const isUnauthorized =
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status: number }).status === 401;

  return (
    <div className="portal-root">
      <header className="portal-header">
        <div>
          <h1>Global Engenharia</h1>
          <p>Portal do Cliente</p>
        </div>
      </header>

      <main className="portal-content">
        {isUnauthorized && (
          <div className="portal-error-box">
            Link inválido ou expirado. Solicite um novo link à nossa equipe.
          </div>
        )}

        {!isUnauthorized && error && (
          <div className="portal-error-box">
            Erro ao carregar suas ordens de serviço. Tente novamente mais tarde.
          </div>
        )}

        {isLoading && <p className="portal-loading">Carregando suas ordens de serviço...</p>}

        {data && data.length === 0 && (
          <p className="portal-empty">Nenhuma ordem de serviço encontrada.</p>
        )}

        {data && data.length > 0 && (
          <div className="portal-os-list">
            {data.map(os => (
              <OSCard key={os.id} os={os} token={token} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
