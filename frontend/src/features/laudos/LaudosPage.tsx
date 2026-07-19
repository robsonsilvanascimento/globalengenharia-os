import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  abrirLaudoPdf,
  carregarFotoBlobUrl,
  useAdicionarFotoLaudo,
  useAtualizarLegendaFoto,
  useAtualizarTrecho,
  useCategoriasTrecho,
  useCriarTrecho,
  useFotosLaudo,
  useRemoverFotoLaudo,
  useRemoverTrecho,
  useSalvarLaudo,
  useTrechos,
  type LaudoFotoMeta,
  type SalvarLaudoInput,
  type SalvarTrechoInput,
  type TrechoNormativo,
} from './useLaudos';
import { redimensionarImagem } from './redimensionarImagem';
import { ESQUELETO_LAUDO } from './esqueleto-laudo';
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

  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [tipo, setTipo] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [normasAplicaveis, setNormasAplicaveis] = useState('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelCrea, setResponsavelCrea] = useState('');
  const [artNumero, setArtNumero] = useState('');
  // Id do laudo persistido. Necessario para anexar fotos (o binario e
  // vinculado ao laudo). Preenchido no primeiro "Salvar rascunho"/"Gerar PDF".
  const [laudoId, setLaudoId] = useState<string | null>(null);

  const categorias = useCategoriasTrecho();
  const trechos = useTrechos({ categoria, busca });
  const salvarLaudo = useSalvarLaudo();

  function montarPayload(): SalvarLaudoInput {
    return {
      id: laudoId ?? undefined,
      titulo: titulo.trim() || 'Laudo Técnico',
      subtitulo: subtitulo.trim() || null,
      tipo: tipo || categoria || 'geral',
      cliente_nome: clienteNome.trim() || null,
      normas_aplicaveis: normasAplicaveis.trim() || null,
      conteudo: texto,
      responsavel_nome: responsavelNome.trim() || null,
      responsavel_crea: responsavelCrea.trim() || null,
      art_numero: artNumero.trim() || null,
    };
  }

  /** Cria/atualiza o laudo e devolve o id (fixando-o para anexar fotos). */
  async function salvar(): Promise<string> {
    const laudo = await salvarLaudo.mutateAsync(montarPayload());
    setLaudoId(laudo.id);
    return laudo.id;
  }

  async function gerarPdf() {
    const id = await salvar();
    await abrirLaudoPdf(id);
  }

  function novoLaudo() {
    if ((texto.trim() || laudoId) && !confirm('Começar um novo laudo em branco? O laudo atual já está salvo e continua acessível.')) return;
    setLaudoId(null);
    setTexto('');
    setTitulo('');
    setSubtitulo('');
    setClienteNome('');
    setNormasAplicaveis('');
  }

  function inserirEsqueleto() {
    if (texto.trim() && !confirm('Substituir o conteúdo atual pelo modelo padrão de laudo?')) return;
    setTexto(ESQUELETO_LAUDO);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

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
          Comece pelo modelo padrão, preencha os campos e clique nos trechos à direita para inseri-los
          no ponto do cursor. Numere as seções (1., 2., 3.) para gerar o sumário; use <code>[NC]</code>{' '}
          para não conformidades, <code>-</code> para listas e linhas com <code>| … | … |</code> para
          tabelas de medições. Anexe fotos no fim da página. O sistema adiciona páginas conforme necessário.
          Confira sempre o número do item da norma antes de assinar.
        </p>
      </header>

      <div className="laudos-grid">
        {/* Editor */}
        <section className="laudos-editor">
          <div className="laudos-metadados">
            <label className="laudos-meta-largo">
              Título do laudo
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Laudo de Sistema de Aterramento" />
            </label>
            <label className="laudos-meta-largo">
              Subtítulo / local (aparece na capa)
              <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} placeholder="Ex.: Edifício Aurora — Bloco A" />
            </label>
            <label>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Selecione…</option>
                {(categorias.data ?? []).map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cliente
              <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome do cliente" />
            </label>
            <label>
              Responsável técnico
              <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} placeholder="Eng. ..." />
            </label>
            <label>
              CREA
              <input value={responsavelCrea} onChange={(e) => setResponsavelCrea(e.target.value)} placeholder="CREA-SP nº ..." />
            </label>
            <label>
              Nº da ART
              <input value={artNumero} onChange={(e) => setArtNumero(e.target.value)} placeholder="Registrada no CREA" />
            </label>
            <label className="laudos-meta-largo">
              Normas aplicáveis (uma por linha — aparece no sumário)
              <textarea
                className="laudos-meta-textarea"
                rows={2}
                value={normasAplicaveis}
                onChange={(e) => setNormasAplicaveis(e.target.value)}
                placeholder={'ABNT NBR 5419:2015 — Proteção contra descargas atmosféricas\nABNT NBR 5410:2004 — Instalações elétricas de baixa tensão'}
              />
            </label>
          </div>
          <div className="laudos-editor-toolbar">
            <span className="laudos-editor-titulo">Documento</span>
            <div className="laudos-editor-acoes">
              <button type="button" onClick={inserirEsqueleto} className="btn-secundario">
                Inserir modelo
              </button>
              <button type="button" onClick={novoLaudo} className="btn-secundario">
                Novo
              </button>
              <button type="button" onClick={copiar} disabled={!texto} className="btn-secundario">
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
              <button type="button" onClick={() => salvar()} disabled={!texto || salvarLaudo.isPending} className="btn-secundario">
                {salvarLaudo.isPending ? 'Salvando…' : laudoId ? 'Salvar' : 'Salvar rascunho'}
              </button>
              <button type="button" onClick={gerarPdf} disabled={!texto || salvarLaudo.isPending} className="btn-primario">
                {salvarLaudo.isPending ? 'Gerando…' : 'Gerar PDF'}
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

          <RelatorioFotografico laudoId={laudoId} onPrecisaSalvar={salvar} />
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

interface RelatorioFotograficoProps {
  laudoId: string | null;
  /** Salva o laudo (criando-o se necessario) e devolve o id, para anexar fotos. */
  onPrecisaSalvar: () => Promise<string>;
}

function RelatorioFotografico({ laudoId, onPrecisaSalvar }: RelatorioFotograficoProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fotos = useFotosLaudo(laudoId);
  const adicionar = useAdicionarFotoLaudo(laudoId ?? '');
  const remover = useRemoverFotoLaudo(laudoId ?? '');
  const atualizarLegenda = useAtualizarLegendaFoto(laudoId ?? '');

  async function aoEscolherArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (arquivos.length === 0) return;

    setErro(null);
    setEnviando(true);
    try {
      // Garante um laudo salvo (id) antes de anexar as fotos.
      await onPrecisaSalvar();
      for (const arquivo of arquivos) {
        if (!arquivo.type.startsWith('image/')) continue;
        const { base64, mimeType } = await redimensionarImagem(arquivo);
        await adicionar.mutateAsync({ base64, mime_type: mimeType, legenda: null });
      }
    } catch {
      setErro('Não foi possível enviar uma ou mais fotos. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  const lista = fotos.data ?? [];

  return (
    <div className="laudos-fotos">
      <div className="laudos-fotos-cab">
        <span className="laudos-editor-titulo">Relatório fotográfico</span>
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={aoEscolherArquivos} />
          <button type="button" className="btn-secundario" onClick={() => fileRef.current?.click()} disabled={enviando}>
            {enviando ? 'Enviando…' : '+ Adicionar fotos'}
          </button>
        </div>
      </div>
      <p className="laudos-fotos-ajuda">
        As fotos entram como uma seção do laudo, com legenda. O sistema adiciona páginas conforme necessário.
        {!laudoId && ' Ao adicionar a primeira foto, o laudo é salvo automaticamente.'}
      </p>
      {erro && <p className="laudos-fotos-erro">{erro}</p>}

      {laudoId && lista.length > 0 && (
        <div className="laudos-fotos-grid">
          {lista.map((foto) => (
            <FotoCard
              key={foto.id}
              laudoId={laudoId}
              foto={foto}
              onLegenda={(legenda) => atualizarLegenda.mutate({ fotoId: foto.id, legenda })}
              onRemover={() => {
                if (confirm('Remover esta foto do laudo?')) remover.mutate(foto.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FotoCardProps {
  laudoId: string;
  foto: LaudoFotoMeta;
  onLegenda: (legenda: string | null) => void;
  onRemover: () => void;
}

function FotoCard({ laudoId, foto, onLegenda, onRemover }: FotoCardProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [legenda, setLegenda] = useState(foto.legenda ?? '');

  useEffect(() => {
    let vivo = true;
    let criada: string | null = null;
    carregarFotoBlobUrl(laudoId, foto.id)
      .then((u) => {
        criada = u;
        if (vivo) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {
        /* preview indisponivel */
      });
    return () => {
      vivo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [laudoId, foto.id]);

  useEffect(() => {
    setLegenda(foto.legenda ?? '');
  }, [foto.legenda]);

  function salvarLegenda() {
    const nova = legenda.trim() || null;
    if (nova !== (foto.legenda ?? null)) onLegenda(nova);
  }

  return (
    <div className="laudos-foto-card">
      <div className="laudos-foto-thumb">{url ? <img src={url} alt={legenda || 'Foto do laudo'} /> : <span>carregando…</span>}</div>
      <input
        className="laudos-foto-legenda"
        value={legenda}
        placeholder="Legenda da foto…"
        onChange={(e) => setLegenda(e.target.value)}
        onBlur={salvarLegenda}
      />
      <button type="button" className="btn-link btn-link-perigo" onClick={onRemover}>
        Remover
      </button>
    </div>
  );
}
