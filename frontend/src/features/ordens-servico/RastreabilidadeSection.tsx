import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../lib/api/httpClient';
import type {
  ComponenteInstalado,
  DocumentoOS,
  RastreabilidadeOS,
  TipoDocumentoOS,
} from '../../types/api';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';

const TIPO_LABELS: Record<TipoDocumentoOS, string> = {
  certificado_garantia: 'Certificado de Garantia',
  manual: 'Manual Técnico',
  laudo_tecnico: 'Laudo Técnico',
  nota_fiscal: 'Nota Fiscal',
  foto: 'Foto',
  outro: 'Outro',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface DocumentoItemProps {
  doc: DocumentoOS;
  ordemServicoId: string;
  podeExcluir: boolean;
  onExcluir: (id: string) => void;
  excluindo: boolean;
}

function DocumentoItem({ doc, ordemServicoId, podeExcluir, onExcluir, excluindo }: DocumentoItemProps) {
  const [baixando, setBaixando] = useState(false);

  async function handleBaixar() {
    setBaixando(true);
    try {
      const blob = await httpClient.getBlob(`/ordens-servico/${ordemServicoId}/documentos/${doc.id}/arquivo`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nome;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="rastreabilidade-documento-item">
      <span className="rastreabilidade-doc-tipo">{TIPO_LABELS[doc.tipo_documento]}</span>
      <span className="rastreabilidade-doc-nome">{doc.nome}</span>
      <span className="rastreabilidade-doc-meta">{formatBytes(doc.tamanho_bytes)} · {formatDate(doc.criado_em)}</span>
      <div className="rastreabilidade-doc-actions">
        <button
          type="button"
          className="rastreabilidade-btn rastreabilidade-btn-outline"
          onClick={handleBaixar}
          disabled={baixando}
        >
          {baixando ? 'Baixando...' : 'Baixar'}
        </button>
        {podeExcluir && (
          <button
            type="button"
            className="rastreabilidade-btn rastreabilidade-btn-danger"
            onClick={() => onExcluir(doc.id)}
            disabled={excluindo}
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

interface ComponenteCardProps {
  componente: ComponenteInstalado;
  ordemServicoId: string;
  podeAdicionarDocumento: boolean;
  podeExcluirDocumento: boolean;
  onRemoverDocumento: (id: string) => void;
  removendoDocumentoId: string | null;
  onAdicionarDocumento: (componenteId: string) => void;
}

function ComponenteCard({
  componente,
  ordemServicoId,
  podeAdicionarDocumento,
  podeExcluirDocumento,
  onRemoverDocumento,
  removendoDocumentoId,
  onAdicionarDocumento,
}: ComponenteCardProps) {
  const garantiaExpirada =
    componente.garantia_expira_em ? new Date(componente.garantia_expira_em) < new Date() : false;

  return (
    <div className="rastreabilidade-componente-card">
      <div className="rastreabilidade-componente-header">
        <div>
          <strong className="rastreabilidade-componente-nome">{componente.nome}</strong>
          {componente.fabricante && (
            <span className="rastreabilidade-componente-detalhe"> · {componente.fabricante}</span>
          )}
          {componente.modelo && (
            <span className="rastreabilidade-componente-detalhe"> · {componente.modelo}</span>
          )}
        </div>
        <div className="rastreabilidade-componente-badges">
          {componente.numero_serie && (
            <span className="rastreabilidade-badge rastreabilidade-badge-gray">
              S/N: {componente.numero_serie}
            </span>
          )}
          {componente.garantia_meses != null && (
            <span
              className={`rastreabilidade-badge ${garantiaExpirada ? 'rastreabilidade-badge-red' : 'rastreabilidade-badge-green'}`}
            >
              {garantiaExpirada ? 'Garantia expirada' : `Garantia até ${formatDate(componente.garantia_expira_em)}`}
            </span>
          )}
        </div>
      </div>

      {componente.observacoes && (
        <p className="rastreabilidade-componente-obs">{componente.observacoes}</p>
      )}

      <div className="rastreabilidade-documentos-lista">
        {componente.documentos.length === 0 && (
          <span className="rastreabilidade-empty-docs">Nenhum documento anexado.</span>
        )}
        {componente.documentos.map((doc) => (
          <DocumentoItem
            key={doc.id}
            doc={doc}
            ordemServicoId={ordemServicoId}
            podeExcluir={podeExcluirDocumento}
            onExcluir={onRemoverDocumento}
            excluindo={removendoDocumentoId === doc.id}
          />
        ))}
      </div>

      {podeAdicionarDocumento && (
        <button
          type="button"
          className="rastreabilidade-btn rastreabilidade-btn-secondary"
          onClick={() => onAdicionarDocumento(componente.id)}
        >
          + Documento neste componente
        </button>
      )}
    </div>
  );
}

interface AdicionarDocumentoModalProps {
  ordemServicoId: string;
  componenteInstaladoId?: string;
  onClose: () => void;
  onSalvo: () => void;
}

function AdicionarDocumentoModal({ ordemServicoId, componenteInstaladoId, onClose, onSalvo }: AdicionarDocumentoModalProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoDocumentoOS>('certificado_garantia');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error('Selecione um arquivo');
      const buffer = await arquivo.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      return httpClient.post(`/ordens-servico/${ordemServicoId}/documentos`, {
        nome,
        tipo_documento: tipo,
        componente_instalado_id: componenteInstaladoId,
        mime_type: arquivo.type || 'application/octet-stream',
        nome_arquivo: arquivo.name,
        conteudo_base64: base64,
      });
    },
    onSuccess: () => { onSalvo(); onClose(); },
    onError: (e: Error) => setErro(e.message),
  });

  return (
    <div className="rastreabilidade-modal-overlay" onClick={onClose}>
      <div className="rastreabilidade-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="rastreabilidade-modal-title">Adicionar Documento</h3>

        <div className="rastreabilidade-form-field">
          <label>Nome do documento</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Certificado de Garantia Siemens" />
        </div>

        <div className="rastreabilidade-form-field">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoOS)}>
            {(Object.entries(TIPO_LABELS) as [TipoDocumentoOS, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="rastreabilidade-form-field">
          <label>Arquivo (PDF, imagem, etc.)</label>
          <input ref={inputRef} type="file" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </div>

        {erro && <p className="rastreabilidade-error">{erro}</p>}

        <div className="rastreabilidade-modal-actions">
          <button type="button" className="rastreabilidade-btn rastreabilidade-btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="rastreabilidade-btn rastreabilidade-btn-primary"
            disabled={!nome || !arquivo || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Enviando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdicionarComponenteModalProps {
  ordemServicoId: string;
  onClose: () => void;
  onSalvo: () => void;
}

function AdicionarComponenteModal({ ordemServicoId, onClose, onSalvo }: AdicionarComponenteModalProps) {
  const [form, setForm] = useState({
    nome: '',
    fabricante: '',
    modelo: '',
    numero_serie: '',
    garantia_meses: '',
    observacoes: '',
  });
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      httpClient.post(`/ordens-servico/${ordemServicoId}/componentes`, {
        nome: form.nome,
        fabricante: form.fabricante || undefined,
        modelo: form.modelo || undefined,
        numero_serie: form.numero_serie || undefined,
        garantia_meses: form.garantia_meses ? Number(form.garantia_meses) : undefined,
        observacoes: form.observacoes || undefined,
      }),
    onSuccess: () => { onSalvo(); onClose(); },
    onError: (e: Error) => setErro(e.message),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="rastreabilidade-modal-overlay" onClick={onClose}>
      <div className="rastreabilidade-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="rastreabilidade-modal-title">Registrar Componente</h3>

        <div className="rastreabilidade-form-row">
          <div className="rastreabilidade-form-field">
            <label>Nome do componente *</label>
            <input value={form.nome} onChange={set('nome')} placeholder="Ex: Disjuntor 63A" />
          </div>
          <div className="rastreabilidade-form-field">
            <label>Fabricante</label>
            <input value={form.fabricante} onChange={set('fabricante')} placeholder="Ex: Siemens" />
          </div>
        </div>

        <div className="rastreabilidade-form-row">
          <div className="rastreabilidade-form-field">
            <label>Modelo</label>
            <input value={form.modelo} onChange={set('modelo')} placeholder="Ex: 5SL6363-7" />
          </div>
          <div className="rastreabilidade-form-field">
            <label>Número de série</label>
            <input value={form.numero_serie} onChange={set('numero_serie')} placeholder="Ex: SN-00123" />
          </div>
        </div>

        <div className="rastreabilidade-form-field">
          <label>Garantia (meses)</label>
          <input type="number" min={1} value={form.garantia_meses} onChange={set('garantia_meses')} placeholder="Ex: 12" />
        </div>

        <div className="rastreabilidade-form-field">
          <label>Observações</label>
          <textarea value={form.observacoes} onChange={set('observacoes')} rows={2} placeholder="Informações adicionais..." />
        </div>

        {erro && <p className="rastreabilidade-error">{erro}</p>}

        <div className="rastreabilidade-modal-actions">
          <button type="button" className="rastreabilidade-btn rastreabilidade-btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="rastreabilidade-btn rastreabilidade-btn-primary"
            disabled={!form.nome || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RastreabilidadeSectionProps {
  ordemServicoId: string;
  isAdmin: boolean;
  isTecnico: boolean;
}

export function RastreabilidadeSection({ ordemServicoId, isAdmin, isTecnico }: RastreabilidadeSectionProps) {
  const queryClient = useQueryClient();
  const podeEditar = isAdmin || isTecnico;

  const [showNovoComponente, setShowNovoComponente] = useState(false);
  const [documentoComponenteId, setDocumentoComponenteId] = useState<string | undefined>(undefined);
  const [showDocumentoModal, setShowDocumentoModal] = useState(false);

  const rastreabilidadeQuery = useQuery<RastreabilidadeOS>({
    queryKey: ['ordens-servico', ordemServicoId, 'rastreabilidade'],
    queryFn: () => httpClient.get(`/ordens-servico/${ordemServicoId}/rastreabilidade`),
  });

  const [removendoDocId, setRemovendoDocId] = useState<string | null>(null);
  const removerDocMutation = useMutation({
    mutationFn: (docId: string) =>
      httpClient.delete(`/ordens-servico/${ordemServicoId}/documentos/${docId}`),
    onMutate: (docId) => setRemovendoDocId(docId),
    onSettled: () => {
      setRemovendoDocId(null);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico', ordemServicoId, 'rastreabilidade'] });
    },
  });

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: ['ordens-servico', ordemServicoId, 'rastreabilidade'] });

  if (rastreabilidadeQuery.isLoading) return <LoadingState message="Carregando rastreabilidade..." />;
  if (rastreabilidadeQuery.isError) return <ErrorState message="Erro ao carregar rastreabilidade." onRetry={() => rastreabilidadeQuery.refetch()} />;

  const dados = rastreabilidadeQuery.data!;

  return (
    <section className="rastreabilidade-section">
      <div className="rastreabilidade-header">
        <h3 className="rastreabilidade-title">Rastreabilidade de Componentes</h3>
        {podeEditar && (
          <button
            type="button"
            className="rastreabilidade-btn rastreabilidade-btn-primary"
            onClick={() => setShowNovoComponente(true)}
          >
            + Componente
          </button>
        )}
      </div>

      {dados.componentes.length === 0 && dados.documentos_sem_componente.length === 0 && (
        <p className="rastreabilidade-empty">Nenhum componente ou documento registrado nesta OS.</p>
      )}

      {dados.componentes.map((c) => (
        <ComponenteCard
          key={c.id}
          componente={c}
          ordemServicoId={ordemServicoId}
          podeAdicionarDocumento={podeEditar}
          podeExcluirDocumento={isAdmin}
          onRemoverDocumento={(id) => removerDocMutation.mutate(id)}
          removendoDocumentoId={removendoDocId}
          onAdicionarDocumento={(cId) => {
            setDocumentoComponenteId(cId);
            setShowDocumentoModal(true);
          }}
        />
      ))}

      {dados.documentos_sem_componente.length > 0 && (
        <div className="rastreabilidade-componente-card">
          <strong className="rastreabilidade-componente-nome">Documentos gerais da OS</strong>
          <div className="rastreabilidade-documentos-lista">
            {dados.documentos_sem_componente.map((doc) => (
              <DocumentoItem
                key={doc.id}
                doc={doc}
                ordemServicoId={ordemServicoId}
                podeExcluir={isAdmin}
                onExcluir={(id) => removerDocMutation.mutate(id)}
                excluindo={removendoDocId === doc.id}
              />
            ))}
          </div>
        </div>
      )}

      {podeEditar && (
        <button
          type="button"
          className="rastreabilidade-btn rastreabilidade-btn-secondary"
          onClick={() => {
            setDocumentoComponenteId(undefined);
            setShowDocumentoModal(true);
          }}
        >
          + Documento geral da OS
        </button>
      )}

      {showNovoComponente && (
        <AdicionarComponenteModal
          ordemServicoId={ordemServicoId}
          onClose={() => setShowNovoComponente(false)}
          onSalvo={invalidar}
        />
      )}

      {showDocumentoModal && (
        <AdicionarDocumentoModal
          ordemServicoId={ordemServicoId}
          componenteInstaladoId={documentoComponenteId}
          onClose={() => setShowDocumentoModal(false)}
          onSalvo={invalidar}
        />
      )}
    </section>
  );
}
