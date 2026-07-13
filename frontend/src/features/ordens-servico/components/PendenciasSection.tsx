import { useState } from 'react';
import { LoadingState } from '../../../components/ui/LoadingState';
import { FotoUploader } from '../../../components/shared/FotoUploader';
import { usePendencias, useRegistrarPendencia } from '../hooks/usePendencias';

interface Props {
  osId: string;
}

export function PendenciasSection({ osId }: Props) {
  const { data: pendencias, isLoading, isError } = usePendencias(osId);
  const registrar = useRegistrarPendencia(osId);

  const [observacao, setObservacao] = useState('');
  const [fotos, setFotos] = useState<Array<{ mime_type: string; base64: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit() {
    if (!observacao.trim()) {
      setFormError('Informe a observação.');
      return;
    }
    if (fotos.length === 0) {
      setFormError('Adicione ao menos uma foto.');
      return;
    }
    setFormError(null);
    registrar.mutate(
      { observacao, fotos },
      {
        onSuccess: () => {
          setObservacao('');
          setFotos([]);
        },
        onError: () => setFormError('Erro ao registrar pendência. Tente novamente.'),
      },
    );
  }

  return (
    <section className="os-detail-card">
      <h2 className="os-detail-section-title">Pendências</h2>

      {isLoading && <LoadingState message="Carregando pendências..." />}
      {isError && <p className="os-detail-error">Erro ao carregar pendências</p>}

      {pendencias && pendencias.length === 0 && (
        <p className="os-detail-no-transition">Nenhuma pendência registrada.</p>
      )}

      {pendencias && pendencias.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
          {pendencias.map((p) => (
            <li key={p.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 500 }}>{p.observacao}</p>
              {p.criado_por_nome && (
                <p style={{ margin: '0 0 6px', fontSize: 12, color: '#6b7280' }}>
                  Por {p.criado_por_nome} — {new Date(p.criado_em).toLocaleString('pt-BR')}
                </p>
              )}
              {p.fotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.fotos.map((f) => (
                    <img
                      key={f.id}
                      src={`data:${f.mime_type};base64,${f.base64}`}
                      alt="foto pendência"
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #d1d5db' }}
                    />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Registrar nova pendência</h3>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Descreva a pendência..."
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 4, border: '1px solid #d1d5db', marginBottom: 12, resize: 'vertical' }}
          disabled={registrar.isPending}
        />
        <FotoUploader
          onFotosChange={setFotos}
          maxFiles={5}
          disabled={registrar.isPending}
        />
        {formError && <p className="os-detail-error" style={{ marginTop: 8 }}>{formError}</p>}
        <button
          type="button"
          className="os-detail-button os-detail-button-primary"
          style={{ marginTop: 12 }}
          onClick={handleSubmit}
          disabled={registrar.isPending}
        >
          {registrar.isPending ? 'Registrando...' : 'Registrar Pendência'}
        </button>
      </div>
    </section>
  );
}
