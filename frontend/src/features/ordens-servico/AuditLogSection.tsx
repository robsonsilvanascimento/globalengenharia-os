import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';

interface AuditEntry {
  id: string;
  entidade: string;
  entidade_id: string;
  acao: string;
  descricao: string | null;
  nome_usuario: string | null;
  ip_address: string | null;
  criado_em: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
}

interface AuditLogResponse {
  data: AuditEntry[];
  total: number;
  pagina: number;
  por_pagina: number;
}

const ACAO_LABELS: Record<string, string> = {
  criar: 'Criação',
  atualizar: 'Atualização',
  apagar: 'Exclusão',
  consultar: 'Consulta',
};

const ACAO_COLORS: Record<string, string> = {
  criar: '#16a34a',
  atualizar: '#2563eb',
  apagar: '#dc2626',
  consultar: '#7c3aed',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

interface AuditLogSectionProps {
  ordemServicoId: string;
}

export function AuditLogSection({ ordemServicoId }: AuditLogSectionProps) {
  const query = useQuery<AuditLogResponse>({
    queryKey: ['ordens-servico', ordemServicoId, 'audit-log'],
    queryFn: () => httpClient.get(`/audit-log?entidade=OrdemServico&entidade_id=${ordemServicoId}&por_pagina=100`),
  });

  function handleExportCSV() {
    httpClient
      .getBlob(`/audit-log?entidade=OrdemServico&entidade_id=${ordemServicoId}&por_pagina=1000&formato=csv`)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-os-${ordemServicoId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Trilha de Auditoria</h3>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            fontSize: '0.8rem',
            padding: '0.35rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid #2563eb',
            background: 'transparent',
            color: '#2563eb',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Exportar CSV
        </button>
      </div>

      {query.isLoading && (
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Carregando auditoria...</p>
      )}
      {query.isError && (
        <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>Erro ao carregar trilha de auditoria.</p>
      )}

      {query.data && query.data.data.length === 0 && (
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Nenhum registro de auditoria ainda.
        </p>
      )}

      {query.data && query.data.data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {query.data.data.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                background: 'var(--color-surface, #f8fafc)',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #e2e8f0)',
                fontSize: '0.82rem',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.15em 0.55em',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  background: `${ACAO_COLORS[entry.acao] ?? '#64748b'}22`,
                  color: ACAO_COLORS[entry.acao] ?? '#64748b',
                  whiteSpace: 'nowrap',
                  minWidth: '75px',
                  textAlign: 'center',
                }}
              >
                {ACAO_LABELS[entry.acao] ?? entry.acao}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--color-text-primary, #1e293b)', fontWeight: 500 }}>
                  {entry.descricao ?? `${entry.entidade} ${entry.acao}`}
                </div>
                <div style={{ color: 'var(--color-text-muted, #94a3b8)', marginTop: '0.15rem' }}>
                  {entry.nome_usuario ? `${entry.nome_usuario}  ·  ` : ''}
                  {formatDateTime(entry.criado_em)}
                  {entry.ip_address ? `  ·  IP: ${entry.ip_address}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
