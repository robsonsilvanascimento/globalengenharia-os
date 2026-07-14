import { useState } from 'react';
import type { Peca } from '../../../types/api';
import {
  usePecas,
  useCriarPeca,
  useAtualizarPeca,
  useEntradaEstoque,
  useAjusteEstoque,
} from '../hooks/useEstoque';
import './EstoquePage.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Aba = 'pecas' | 'alertas';

interface PecaFormData {
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
  precoUnitario: string;
  estoqueAtual: string;
  estoqueMinimo: string;
}

const PECA_FORM_VAZIO: PecaFormData = {
  codigo: '',
  nome: '',
  descricao: '',
  unidade: '',
  precoUnitario: '',
  estoqueAtual: '',
  estoqueMinimo: '',
};

function pecaParaForm(p: Peca): PecaFormData {
  return {
    codigo: p.codigo,
    nome: p.nome,
    descricao: p.descricao ?? '',
    unidade: p.unidade,
    precoUnitario: String(p.precoUnitario),
    estoqueAtual: String(p.estoqueAtual),
    estoqueMinimo: String(p.estoqueMinimo),
  };
}

export default function EstoquePage() {
  const [aba, setAba] = useState<Aba>('pecas');
  const [search, setSearch] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<boolean | undefined>(undefined);

  const [modalPecaAberto, setModalPecaAberto] = useState(false);
  const [pecaEditando, setPecaEditando] = useState<Peca | null>(null);
  const [formPeca, setFormPeca] = useState<PecaFormData>(PECA_FORM_VAZIO);

  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [pecaEntrada, setPecaEntrada] = useState<Peca | null>(null);
  const [entradaQtd, setEntradaQtd] = useState('');
  const [entradaObs, setEntradaObs] = useState('');

  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [pecaAjuste, setPecaAjuste] = useState<Peca | null>(null);
  const [ajusteNovoEstoque, setAjusteNovoEstoque] = useState('');
  const [ajusteObs, setAjusteObs] = useState('');

  const { data: pecas = [], isLoading, isError } = usePecas({ search: search || undefined, ativo: filtroAtivo });
  const criarPeca = useCriarPeca();
  const atualizarPeca = useAtualizarPeca(pecaEditando?.id ?? '');
  const entradaEstoque = useEntradaEstoque(pecaEntrada?.id ?? '');
  const ajusteEstoque = useAjusteEstoque(pecaAjuste?.id ?? '');

  const alertas = pecas.filter((p) => p.estoqueAtual <= p.estoqueMinimo);

  function abrirModalNovaPeca() {
    setPecaEditando(null);
    setFormPeca(PECA_FORM_VAZIO);
    setModalPecaAberto(true);
  }

  function abrirModalEditar(p: Peca) {
    setPecaEditando(p);
    setFormPeca(pecaParaForm(p));
    setModalPecaAberto(true);
  }

  function abrirModalEntrada(p: Peca) {
    setPecaEntrada(p);
    setEntradaQtd('');
    setEntradaObs('');
    setModalEntradaAberto(true);
  }

  function fecharModalPeca() {
    setModalPecaAberto(false);
    setPecaEditando(null);
  }

  function fecharModalEntrada() {
    setModalEntradaAberto(false);
    setPecaEntrada(null);
  }

  function abrirModalAjuste(p: Peca) {
    setPecaAjuste(p);
    setAjusteNovoEstoque(String(p.estoqueAtual));
    setAjusteObs('');
    setModalAjusteAberto(true);
  }

  function fecharModalAjuste() {
    setModalAjusteAberto(false);
    setPecaAjuste(null);
  }

  async function handleSalvarAjuste(e: React.FormEvent) {
    e.preventDefault();
    if (!pecaAjuste) return;
    await ajusteEstoque.mutateAsync({
      novoEstoque: parseFloat(ajusteNovoEstoque),
      observacao: ajusteObs || undefined,
    });
    fecharModalAjuste();
  }

  async function handleSalvarPeca(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      codigo: formPeca.codigo,
      nome: formPeca.nome,
      descricao: formPeca.descricao || undefined,
      unidade: formPeca.unidade,
      precoUnitario: parseFloat(formPeca.precoUnitario),
      estoqueAtual: parseFloat(formPeca.estoqueAtual),
      estoqueMinimo: parseFloat(formPeca.estoqueMinimo),
    };

    if (pecaEditando) {
      await atualizarPeca.mutateAsync(body);
    } else {
      await criarPeca.mutateAsync(body);
    }
    fecharModalPeca();
  }

  async function handleSalvarEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!pecaEntrada) return;
    await entradaEstoque.mutateAsync({
      quantidade: parseFloat(entradaQtd),
      observacao: entradaObs || undefined,
    });
    fecharModalEntrada();
  }

  return (
    <div className="estoque-page">
      <div className="estoque-header">
        <h1>Gestão de Estoque</h1>
        <button type="button" className="btn-primary" onClick={abrirModalNovaPeca}>
          + Nova Peça
        </button>
      </div>

      <div className="estoque-abas">
        <button
          type="button"
          className={aba === 'pecas' ? 'aba-btn aba-btn-ativa' : 'aba-btn'}
          onClick={() => setAba('pecas')}
        >
          Peças
        </button>
        <button
          type="button"
          className={aba === 'alertas' ? 'aba-btn aba-btn-ativa' : 'aba-btn'}
          onClick={() => setAba('alertas')}
        >
          Alertas de Estoque Mínimo
          {alertas.length > 0 && (
            <span className="badge-alerta">{alertas.length}</span>
          )}
        </button>
      </div>

      {aba === 'pecas' && (
        <div className="estoque-conteudo">
          <div className="estoque-filtros">
            <input
              type="search"
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="estoque-search"
            />
            <select
              value={filtroAtivo === undefined ? '' : String(filtroAtivo)}
              onChange={(e) => {
                const v = e.target.value;
                setFiltroAtivo(v === '' ? undefined : v === 'true');
              }}
              className="estoque-select"
            >
              <option value="">Todos</option>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>

          {isLoading && <p>Carregando...</p>}
          {isError && <p className="estoque-erro">Erro ao carregar peças.</p>}

          {!isLoading && !isError && (
            <div className="estoque-table-wrap">
              <table className="estoque-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nome</th>
                    <th>Unidade</th>
                    <th>Preço Unit.</th>
                    <th>Estoque Atual</th>
                    <th>Estoque Mín.</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((p) => {
                    const baixo = p.estoqueAtual <= p.estoqueMinimo;
                    return (
                      <tr key={p.id} className={baixo ? 'linha-baixo' : ''}>
                        <td>{p.codigo}</td>
                        <td>{p.nome}</td>
                        <td>{p.unidade}</td>
                        <td>{currencyFormatter.format(Number(p.precoUnitario))}</td>
                        <td>
                          {p.estoqueAtual}
                          {baixo && <span className="badge-baixo">Baixo</span>}
                        </td>
                        <td>{p.estoqueMinimo}</td>
                        <td>
                          <span className={p.ativo ? 'badge-ativo' : 'badge-inativo'}>
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="acoes-col">
                          <button
                            type="button"
                            className="btn-sm btn-entrada"
                            onClick={() => abrirModalEntrada(p)}
                          >
                            Entrada
                          </button>
                          <button
                            type="button"
                            className="btn-sm btn-ajuste"
                            onClick={() => abrirModalAjuste(p)}
                          >
                            Ajustar
                          </button>
                          <button
                            type="button"
                            className="btn-sm btn-editar"
                            onClick={() => abrirModalEditar(p)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pecas.length === 0 && (
                    <tr>
                      <td colSpan={8} className="sem-dados">
                        Nenhuma peça encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === 'alertas' && (
        <div className="estoque-conteudo">
          {alertas.length === 0 ? (
            <p className="sem-alertas">Nenhuma peça com estoque abaixo do mínimo.</p>
          ) : (
            <ul className="alertas-lista">
              {alertas.map((p) => (
                <li key={p.id} className="alerta-item">
                  <div className="alerta-info">
                    <strong>{p.nome}</strong>
                    <span className="alerta-codigo">{p.codigo}</span>
                    <span className="alerta-estoque">
                      Atual: <strong className="txt-vermelho">{p.estoqueAtual}</strong> / Mínimo: {p.estoqueMinimo}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-sm btn-entrada"
                    onClick={() => abrirModalEntrada(p)}
                  >
                    Registrar Entrada
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modalPecaAberto && (
        <div className="modal-overlay" onClick={fecharModalPeca}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>{pecaEditando ? 'Editar Peça' : 'Nova Peça'}</h2>
            <form onSubmit={handleSalvarPeca} className="modal-form">
              <label>
                Código
                <input
                  required
                  value={formPeca.codigo}
                  onChange={(e) => setFormPeca((f) => ({ ...f, codigo: e.target.value }))}
                />
              </label>
              <label>
                Nome
                <input
                  required
                  value={formPeca.nome}
                  onChange={(e) => setFormPeca((f) => ({ ...f, nome: e.target.value }))}
                />
              </label>
              <label>
                Descrição
                <textarea
                  value={formPeca.descricao}
                  onChange={(e) => setFormPeca((f) => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                />
              </label>
              <label>
                Unidade
                <input
                  required
                  value={formPeca.unidade}
                  onChange={(e) => setFormPeca((f) => ({ ...f, unidade: e.target.value }))}
                />
              </label>
              <label>
                Preço Unitário (R$)
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formPeca.precoUnitario}
                  onChange={(e) => setFormPeca((f) => ({ ...f, precoUnitario: e.target.value }))}
                />
              </label>
              <label>
                Estoque Atual
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={formPeca.estoqueAtual}
                  onChange={(e) => setFormPeca((f) => ({ ...f, estoqueAtual: e.target.value }))}
                />
              </label>
              <label>
                Estoque Mínimo
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={formPeca.estoqueMinimo}
                  onChange={(e) => setFormPeca((f) => ({ ...f, estoqueMinimo: e.target.value }))}
                />
              </label>
              <div className="modal-acoes">
                <button type="button" className="btn-secondary" onClick={fecharModalPeca}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={criarPeca.isPending || atualizarPeca.isPending}
                >
                  {criarPeca.isPending || atualizarPeca.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEntradaAberto && pecaEntrada && (
        <div className="modal-overlay" onClick={fecharModalEntrada}>
          <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar Entrada</h2>
            <p className="modal-peca-nome">
              {pecaEntrada.nome} <span className="alerta-codigo">{pecaEntrada.codigo}</span>
            </p>
            <form onSubmit={handleSalvarEntrada} className="modal-form">
              <label>
                Quantidade
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={entradaQtd}
                  onChange={(e) => setEntradaQtd(e.target.value)}
                />
              </label>
              <label>
                Observação
                <textarea
                  value={entradaObs}
                  onChange={(e) => setEntradaObs(e.target.value)}
                  rows={2}
                />
              </label>
              <div className="modal-acoes">
                <button type="button" className="btn-secondary" onClick={fecharModalEntrada}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={entradaEstoque.isPending}
                >
                  {entradaEstoque.isPending ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalAjusteAberto && pecaAjuste && (
        <div className="modal-overlay" onClick={fecharModalAjuste}>
          <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Ajustar Estoque</h2>
            <p className="modal-peca-nome">
              {pecaAjuste.nome} <span className="alerta-codigo">{pecaAjuste.codigo}</span>
            </p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Estoque atual: <strong>{pecaAjuste.estoqueAtual}</strong>
            </p>
            <form onSubmit={handleSalvarAjuste} className="modal-form">
              <label>
                Novo valor do estoque
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={ajusteNovoEstoque}
                  onChange={(e) => setAjusteNovoEstoque(e.target.value)}
                />
              </label>
              <label>
                Motivo do ajuste
                <textarea
                  value={ajusteObs}
                  onChange={(e) => setAjusteObs(e.target.value)}
                  rows={2}
                  placeholder="Ex: contagem física, perda, devolução..."
                />
              </label>
              <div className="modal-acoes">
                <button type="button" className="btn-secondary" onClick={fecharModalAjuste}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={ajusteEstoque.isPending}
                >
                  {ajusteEstoque.isPending ? 'Salvando...' : 'Confirmar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
