import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  useAtualizarTrecho,
  useCategoriasTrecho,
  useCriarTrecho,
  useRemoverTrecho,
  useTrechos,
  type SalvarTrechoInput,
  type TrechoNormativo,
} from './useLaudos';
import './LaudosPage.css';

const FORM_VAZIO: SalvarTrechoInput = {
  norma: '',
  item: '',
  categoria: '',
  assunto: '',
  texto: '',
  item_verificar: true,
};

export function LaudosPage() {
  const { papel } = useAuth();
  const isAdmin = papel === 'admin';

  const [categoria, setCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const categorias = useCategoriasTrecho();
  const trechos = useTrechos({ categoria, busca });

  const rotuloCategoria = useMemo(() => {
    const mapa = new Map((categorias.data ?? []).map((c) => [c.valor, c.rotulo]));
    return (valor: string) => mapa.get(valor) ?? valor;
  }, [categorias.data]);

  function inserirTrecho(trecho: TrechoNormativo) {
    const ta = textareaRef.current;
    const conteudo = trecho.texto;
    if (!ta) {
      setTexto((prev) => (prev ? `${prev}\n\n${conteudo}` : conteudo));
      return;
    }
    const inicio = ta.selectionStart;
    const fim = ta.selectionEnd;
    const precisaQuebra = inicio > 0 && texto[inicio - 1] !== '\n';
    const insercao = (precisaQuebra ? '\n\n' : '') + conteudo;
    const novo = texto.slice(0, inicio) + insercao + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = inicio + insercao.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // area de transferencia indisponivel: ignora silenciosamente
    }
  }

  return (
    <div className="laudos-page">
      <header className="laudos-head">
        <h1>Laudos Técnicos</h1>
        <p>
          Monte o laudo à esquerda e clique nos trechos à direita para inseri-los no ponto do cursor.
          Confira sempre o número do item da norma antes de assinar.
        </p>
      </header>

      <div className="laudos-grid">
        {/* Editor */}
        <section className="laudos-editor">
          <div className="laudos-editor-toolbar">
            <span className="laudos-editor-titulo">Documento</span>
            <div className="laudos-editor-acoes">
              <button type="button" onClick={copiar} disabled={!texto} className="btn-secundario">
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
              <button type="button" onClick={() => setTexto('')} disabled={!texto} className="btn-secundario">
                Limpar
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="laudos-textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Comece a escrever o laudo ou insira trechos da biblioteca ao lado…"
            spellCheck
          />
          <div className="laudos-editor-rodape">{texto.length} caracteres</div>
        </section>

        {/* Biblioteca */}
        <aside className="laudos-biblioteca">
          <BibliotecaTrechos
            categoria={categoria}
            setCategoria={setCategoria}
            busca={busca}
            setBusca={setBusca}
            categorias={categorias.data ?? []}
            trechos={trechos.data ?? []}
            carregando={trechos.isLoading}
            rotuloCategoria={rotuloCategoria}
            onInserir={inserirTrecho}
            isAdmin={isAdmin}
          />
        </aside>
      </div>
    </div>
  );
}

interface BibliotecaProps {
  categoria: string;
  setCategoria: (v: string) => void;
  busca: string;
  setBusca: (v: string) => void;
  categorias: { valor: string; rotulo: string }[];
  trechos: TrechoNormativo[];
  carregando: boolean;
  rotuloCategoria: (valor: string) => string;
  onInserir: (t: TrechoNormativo) => void;
  isAdmin: boolean;
}

function BibliotecaTrechos(props: BibliotecaProps) {
  const [form, setForm] = useState<{ id: string | null; dados: SalvarTrechoInput } | null>(null);
  const criar = useCriarTrecho();
  const atualizar = useAtualizarTrecho();
  const remover = useRemoverTrecho();

  function abrirNovo() {
    setForm({ id: null, dados: { ...FORM_VAZIO, categoria: props.categoria || '' } });
  }
  function abrirEdicao(t: TrechoNormativo) {
    setForm({
      id: t.id,
      dados: {
        norma: t.norma,
        item: t.item ?? '',
        categoria: t.categoria,
        assunto: t.assunto,
        texto: t.texto,
        item_verificar: t.itemVerificar,
      },
    });
  }
  async function salvar() {
    if (!form) return;
    if (form.id) await atualizar.mutateAsync({ id: form.id, body: form.dados });
    else await criar.mutateAsync(form.dados);
    setForm(null);
  }

  return (
    <>
      <div className="laudos-filtros">
        <select value={props.categoria} onChange={(e) => props.setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {props.categorias.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Buscar por assunto, texto ou item…"
          value={props.busca}
          onChange={(e) => props.setBusca(e.target.value)}
        />
        {props.isAdmin && (
          <button type="button" className="btn-primario" onClick={abrirNovo}>
            + Novo trecho
          </button>
        )}
      </div>

      {props.carregando && <p className="laudos-info">Carregando…</p>}
      {!props.carregando && props.trechos.length === 0 && (
        <p className="laudos-info">Nenhum trecho encontrado com esse filtro.</p>
      )}

      <ul className="laudos-lista">
        {props.trechos.map((t) => (
          <li key={t.id} className="laudos-trecho">
            <div className="laudos-trecho-cab">
              <span className="laudos-trecho-assunto">{t.assunto}</span>
              <span className="laudos-trecho-norma">
                {t.norma}
                {t.item ? ` · ${t.item}` : ''}
              </span>
            </div>
            {t.itemVerificar && <span className="laudos-badge-verificar">conferir item na norma vigente</span>}
            <p className="laudos-trecho-texto">{t.texto}</p>
            <div className="laudos-trecho-acoes">
              <button type="button" className="btn-inserir" onClick={() => props.onInserir(t)}>
                Inserir no laudo
              </button>
              {props.isAdmin && (
                <>
                  <button type="button" className="btn-link" onClick={() => abrirEdicao(t)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-link btn-link-perigo"
                    onClick={() => {
                      if (confirm(`Remover o trecho "${t.assunto}"?`)) remover.mutate(t.id);
                    }}
                  >
                    Remover
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {form && (
        <TrechoForm
          titulo={form.id ? 'Editar trecho' : 'Novo trecho'}
          dados={form.dados}
          categorias={props.categorias}
          salvando={criar.isPending || atualizar.isPending}
          onChange={(dados) => setForm({ ...form, dados })}
          onCancelar={() => setForm(null)}
          onSalvar={salvar}
        />
      )}
    </>
  );
}

interface TrechoFormProps {
  titulo: string;
  dados: SalvarTrechoInput;
  categorias: { valor: string; rotulo: string }[];
  salvando: boolean;
  onChange: (dados: SalvarTrechoInput) => void;
  onCancelar: () => void;
  onSalvar: () => void;
}

function TrechoForm(props: TrechoFormProps) {
  const { dados } = props;
  const valido = dados.norma.trim() && dados.categoria.trim() && dados.assunto.trim() && dados.texto.trim();
  return (
    <div className="laudos-modal-overlay" onClick={props.onCancelar}>
      <div className="laudos-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{props.titulo}</h2>
        <label>
          Categoria
          <select value={dados.categoria} onChange={(e) => props.onChange({ ...dados, categoria: e.target.value })}>
            <option value="">Selecione…</option>
            {props.categorias.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className="laudos-modal-linha">
          <label>
            Norma
            <input value={dados.norma} onChange={(e) => props.onChange({ ...dados, norma: e.target.value })} placeholder="Ex.: NBR 5410" />
          </label>
          <label>
            Item (opcional)
            <input value={dados.item ?? ''} onChange={(e) => props.onChange({ ...dados, item: e.target.value })} placeholder="Ex.: 5.1.3.2.2" />
          </label>
        </div>
        <label>
          Assunto
          <input value={dados.assunto} onChange={(e) => props.onChange({ ...dados, assunto: e.target.value })} placeholder="Ex.: Proteção por DR em áreas molhadas" />
        </label>
        <label>
          Texto do trecho
          <textarea rows={5} value={dados.texto} onChange={(e) => props.onChange({ ...dados, texto: e.target.value })} />
        </label>
        <label className="laudos-check">
          <input
            type="checkbox"
            checked={dados.item_verificar ?? false}
            onChange={(e) => props.onChange({ ...dados, item_verificar: e.target.checked })}
          />
          Marcar para conferir o número do item na edição vigente da norma
        </label>
        <div className="laudos-modal-acoes">
          <button type="button" className="btn-secundario" onClick={props.onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn-primario" disabled={!valido || props.salvando} onClick={props.onSalvar}>
            {props.salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
