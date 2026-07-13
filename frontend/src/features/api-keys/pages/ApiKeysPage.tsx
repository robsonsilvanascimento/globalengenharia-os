import { useState } from 'react';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '../hooks/useApiKeys';
import type { ApiKeyCreated } from '../hooks/useApiKeys';
import './ApiKeysPage.css';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function ApiKeysPage() {
  const { data: apiKeys = [], isLoading, isError } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [nome, setNome] = useState('');

  const [chaveCriada, setChaveCriada] = useState<ApiKeyCreated | null>(null);
  const [copiado, setCopiado] = useState(false);

  function abrirModalNova() {
    setNome('');
    setModalNovaAberto(true);
  }

  function fecharModalNova() {
    setModalNovaAberto(false);
    setNome('');
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    const result = await createApiKey.mutateAsync({ nome });
    fecharModalNova();
    setChaveCriada(result);
    setCopiado(false);
  }

  function handleCopiar() {
    if (!chaveCriada) return;
    navigator.clipboard.writeText(chaveCriada.chave).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  function fecharModalChave() {
    setChaveCriada(null);
  }

  async function handleRevogar(id: string, nomeDaChave: string) {
    const confirmado = window.confirm(
      `Revogar a chave "${nomeDaChave}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmado) return;
    await deleteApiKey.mutateAsync(id);
  }

  return (
    <div className="api-keys-page">
      <div className="api-keys-header">
        <h1>Chaves de API</h1>
        <button type="button" className="btn-primary" onClick={abrirModalNova}>
          + Nova Chave
        </button>
      </div>

      {isLoading && <p>Carregando...</p>}
      {isError && <p className="api-keys-erro">Erro ao carregar chaves de API.</p>}

      {!isLoading && !isError && (
        <div className="api-keys-table-wrap">
          <table className="api-keys-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Prefixo</th>
                <th>Status</th>
                <th>Criada em</th>
                <th>Último uso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id}>
                  <td>{key.nome}</td>
                  <td>
                    <code className="api-key-prefixo">{key.prefixo}</code>
                  </td>
                  <td>
                    <span className={key.ativa ? 'badge-ativo' : 'badge-inativo'}>
                      {key.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>{formatDate(key.criadoEm)}</td>
                  <td>{formatDate(key.ultimoUsoEm)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-sm btn-revogar"
                      disabled={deleteApiKey.isPending}
                      onClick={() => handleRevogar(key.id, key.nome)}
                    >
                      Revogar
                    </button>
                  </td>
                </tr>
              ))}
              {apiKeys.length === 0 && (
                <tr>
                  <td colSpan={6} className="sem-dados">
                    Nenhuma chave de API cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: criar nova chave */}
      {modalNovaAberto && (
        <div className="modal-overlay" onClick={fecharModalNova}>
          <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Nova Chave de API</h2>
            <form onSubmit={handleCriar} className="modal-form">
              <label>
                Nome
                <input
                  required
                  autoFocus
                  placeholder="Ex: Integração ERP"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </label>
              <div className="modal-acoes">
                <button type="button" className="btn-secondary" onClick={fecharModalNova}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={createApiKey.isPending}>
                  {createApiKey.isPending ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: exibir chave gerada (única vez) */}
      {chaveCriada && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Chave criada com sucesso</h2>
            <div className="api-key-alerta">
              <strong>Guarde agora — esta chave nao sera exibida novamente.</strong>
            </div>
            <p className="api-key-nome-label">
              Nome: <strong>{chaveCriada.nome}</strong>
            </p>
            <div className="api-key-reveal">
              <code className="api-key-valor">{chaveCriada.chave}</code>
              <button type="button" className="btn-copiar" onClick={handleCopiar}>
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="modal-acoes">
              <button type="button" className="btn-primary" onClick={fecharModalChave}>
                Entendido, ja guardei
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
