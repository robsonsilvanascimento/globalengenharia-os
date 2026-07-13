import { useState } from 'react';
import { LoadingState } from '../../../components/ui/LoadingState';
import { FotoUploader } from '../../../components/shared/FotoUploader';
import { useFotosEvidencia, useAdicionarFotoEvidencia } from '../hooks/useFotosEvidencia';

interface Props {
  osId: string;
}

export function FotosEvidenciaSection({ osId }: Props) {
  const { data, isLoading, isError } = useFotosEvidencia(osId);
  const adicionar = useAdicionarFotoEvidencia(osId);

  const [foto, setFoto] = useState<{ mime_type: string; base64: string } | null>(null);
  const [legenda, setLegenda] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fotos = data?.fotos ?? [];

  function handleSubmit() {
    if (!foto) {
      setFormError('Selecione uma foto.');
      return;
    }
    setFormError(null);
    adicionar.mutate(
      { mime_type: foto.mime_type, base64: foto.base64, legenda: legenda || undefined },
      {
        onSuccess: () => {
          setFoto(null);
          setLegenda('');
        },
        onError: () => setFormError('Erro ao adicionar foto. Tente novamente.'),
      },
    );
  }

  return (
    <section className="os-detail-card">
      <h2 className="os-detail-section-title">Fotos de Evidência</h2>

      {isLoading && <LoadingState message="Carregando fotos..." />}
      {isError && <p className="os-detail-error">Erro ao carregar fotos de evidência</p>}

      {!isLoading && !isError && fotos.length === 0 && (
        <p className="os-detail-no-transition">Nenhuma foto de evidência adicionada.</p>
      )}

      {fotos.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {fotos.map((f) => (
            <div key={f.id} style={{ width: 140 }}>
              <img
                src={`data:${f.mime_type};base64,${f.base64}`}
                alt={f.legenda ?? 'evidência'}
                style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1d5db', display: 'block' }}
              />
              {f.legenda && (
                <p style={{ margin: '4px 0 2px', fontSize: 12, fontWeight: 500, color: '#374151' }}>{f.legenda}</p>
              )}
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                {f.enviado_por_nome && `${f.enviado_por_nome} · `}
                {new Date(f.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Adicionar foto</h3>
        <FotoUploader
          onFotosChange={(fs) => setFoto(fs[0] ?? null)}
          maxFiles={1}
          disabled={adicionar.isPending}
        />
        <input
          type="text"
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          placeholder="Legenda (opcional)"
          style={{ marginTop: 10, width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 4, border: '1px solid #d1d5db' }}
          disabled={adicionar.isPending}
        />
        {formError && <p className="os-detail-error" style={{ marginTop: 8 }}>{formError}</p>}
        <button
          type="button"
          className="os-detail-button os-detail-button-primary"
          style={{ marginTop: 12 }}
          onClick={handleSubmit}
          disabled={adicionar.isPending}
        >
          {adicionar.isPending ? 'Adicionando...' : 'Adicionar Foto'}
        </button>
      </div>
    </section>
  );
}
