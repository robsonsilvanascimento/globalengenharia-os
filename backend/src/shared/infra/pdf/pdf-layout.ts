import path from 'node:path';

/**
 * Kit de layout compartilhado pelos documentos em PDF (Ordem de Servico e
 * Recibo de Pagamento). Centraliza a paleta da marca Global Engenharia e as
 * primitivas de desenho (cabecalho com logo, selos coloridos, titulos de
 * secao, campos, rodape) para que os dois documentos tenham identidade
 * visual consistente sem duplicar codigo de posicionamento do pdfkit.
 *
 * Todas as cores usadas aqui vivem dentro da faixa Latin-1/WinAnsi das
 * fontes padrao do pdfkit (Helvetica), assim como os textos com acento e os
 * simbolos "Nº", "—" e "·" — evita-se de proposito qualquer glyph fora
 * dessa faixa (ex.: "✓"), que sairia vazio no PDF.
 */
export type DocumentoPdf = PDFKit.PDFDocument;

export const CORES = {
  marca: '#34568B',
  marcaEscura: '#24406C',
  marcaSuave: '#EDF1F8',
  tinta: '#1E2733',
  tintaSuave: '#55616F',
  tintaFraca: '#8A94A2',
  linha: '#E2E6EC',
  ok: '#0F8A57',
  okSuave: '#E3F4EB',
  okBorda: '#BFE6CF',
  fundoDescricao: '#E9EDF3',
  textoDescricao: '#2C3542',
  branco: '#FFFFFF',
} as const;

interface CorSelo {
  fundo: string;
  texto: string;
}

const CORES_SELO_FALLBACK: CorSelo = { fundo: '#EEF0F3', texto: '#55616F' };

const PRIORIDADE_CORES: Record<string, CorSelo> = {
  baixa: { fundo: '#EAF1F7', texto: '#3F6088' },
  normal: { fundo: '#E3F4EB', texto: '#0F8A57' },
  alta: { fundo: '#FBEFD6', texto: '#A9700A' },
  urgente: { fundo: '#FBE4E1', texto: '#C0392B' },
};

const STATUS_CORES: Record<string, CorSelo> = {
  aberta: { fundo: '#EDF1F8', texto: '#24406C' },
  triagem: { fundo: '#EDF1F8', texto: '#24406C' },
  atribuida: { fundo: '#FBEFD6', texto: '#A9700A' },
  em_andamento: { fundo: '#FBEFD6', texto: '#A9700A' },
  aguardando_peca: { fundo: '#FBEFD6', texto: '#A9700A' },
  concluida: { fundo: '#E3F4EB', texto: '#0F8A57' },
  cancelada: { fundo: '#FBE4E1', texto: '#C0392B' },
};

export const PRIORIDADE_ROTULO: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const STATUS_ROTULO: Record<string, string> = {
  aberta: 'Aberta',
  triagem: 'Triagem',
  atribuida: 'Atribuída',
  em_andamento: 'Em andamento',
  aguardando_peca: 'Aguardando peça',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export function corDePrioridade(prioridade: string): CorSelo {
  return PRIORIDADE_CORES[prioridade] ?? CORES_SELO_FALLBACK;
}

export function corDeStatus(status: string): CorSelo {
  return STATUS_CORES[status] ?? CORES_SELO_FALLBACK;
}

export const NOME_EMPRESA = 'Global Engenharia';
const LARGURA_LOGO = 150;

// __dirname aponta para src/shared/infra/pdf (dev) ou dist/shared/infra/pdf
// (producao, estrutura espelhada por tsc). Em ambos, subir 4 niveis chega a
// raiz de backend/, onde vive assets/brand/logo.png.
export function resolverCaminhoPadraoDoLogo(): string {
  return path.join(__dirname, '..', '..', '..', '..', 'assets', 'brand', 'logo.png');
}

/** Retorna os limites da area util (dentro das margens) da pagina atual. */
export function area(doc: DocumentoPdf): { esquerda: number; direita: number; largura: number } {
  const esquerda = doc.page.margins.left;
  const direita = doc.page.width - doc.page.margins.right;
  return { esquerda, direita, largura: direita - esquerda };
}

/** Faixa fina na cor da marca no topo absoluto da folha (de borda a borda). */
export function barraTopo(doc: DocumentoPdf): void {
  doc.save();
  doc.rect(0, 0, doc.page.width, 7).fill(CORES.marca);
  doc.restore();
}

/**
 * Cabecalho: logo da empresa a esquerda e um cartao na cor da marca a
 * direita com o rotulo e o numero do documento. Se o arquivo do logo nao
 * existir/estiver ilegivel, cai para o nome da empresa em texto (o PDF nunca
 * quebra por causa do logo). Retorna o `y` logo abaixo do cabecalho.
 */
export function cabecalho(
  doc: DocumentoPdf,
  opcoes: { rotuloNumero: string; numero: string; caminhoLogo?: string },
): number {
  const { esquerda, direita } = area(doc);
  const topo = 30;
  const caminhoLogo = opcoes.caminhoLogo ?? resolverCaminhoPadraoDoLogo();

  let alturaLogo = 0;
  let logoInserido = false;
  try {
    const abrirImagem = (
      doc as unknown as { openImage: (src: string) => { width: number; height: number } }
    ).openImage.bind(doc);
    const imagemLogo = abrirImagem(caminhoLogo);
    alturaLogo = (LARGURA_LOGO / imagemLogo.width) * imagemLogo.height;
    doc.image(caminhoLogo, esquerda, topo, { width: LARGURA_LOGO });
    logoInserido = true;
  } catch {
    logoInserido = false;
  }

  if (!logoInserido) {
    doc.fillColor(CORES.marcaEscura).font('Helvetica-Bold').fontSize(18).text(NOME_EMPRESA, esquerda, topo);
    alturaLogo = 22;
  }

  const larguraCartao = 176;
  const alturaCartao = 46;
  const xCartao = direita - larguraCartao;
  const yCartao = topo;

  doc.save();
  doc.roundedRect(xCartao, yCartao, larguraCartao, alturaCartao, 8).fill(CORES.marca);
  doc.restore();

  doc
    .fillColor(CORES.branco)
    .font('Helvetica')
    .fontSize(7.5)
    .text(opcoes.rotuloNumero.toUpperCase(), xCartao + 14, yCartao + 10, { width: larguraCartao - 28 });
  doc
    .fillColor(CORES.branco)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(opcoes.numero, xCartao + 14, yCartao + 23, { width: larguraCartao - 28, lineBreak: false });

  return Math.max(topo + alturaLogo, yCartao + alturaCartao) + 18;
}

/**
 * Desenha um selo arredondado (pilula) com texto em maiusculas. Retorna a
 * largura ocupada, para posicionar o proximo selo ao lado.
 */
export function selo(
  doc: DocumentoPdf,
  x: number,
  y: number,
  texto: string,
  fundo: string,
  corTexto: string,
): number {
  const rotulo = texto.toUpperCase();
  const padX = 10;
  const altura = 16;
  doc.font('Helvetica-Bold').fontSize(8);
  const larguraTexto = doc.widthOfString(rotulo);
  const largura = larguraTexto + padX * 2;

  doc.save();
  doc.roundedRect(x, y, largura, altura, altura / 2).fill(fundo);
  doc.restore();

  doc.fillColor(corTexto).font('Helvetica-Bold').fontSize(8).text(rotulo, x + padX, y + 4.5, { lineBreak: false });
  return largura;
}

/** Titulo de secao: marcador vertical na cor da marca + texto. Retorna o `y` abaixo. */
export function tituloSecao(doc: DocumentoPdf, y: number, texto: string): number {
  const { esquerda } = area(doc);
  doc.save();
  doc.roundedRect(esquerda, y + 1, 4, 12, 1).fill(CORES.marca);
  doc.restore();
  doc.fillColor(CORES.marca).font('Helvetica-Bold').fontSize(10).text(texto.toUpperCase(), esquerda + 12, y);
  return y + 22;
}

/** Campo rotulo/valor. Retorna a altura ocupada (para alinhar colunas). */
export function campo(
  doc: DocumentoPdf,
  x: number,
  y: number,
  largura: number,
  rotulo: string,
  valor: string,
): number {
  doc.fillColor(CORES.tintaFraca).font('Helvetica').fontSize(8).text(rotulo.toUpperCase(), x, y, { width: largura });
  doc.fillColor(CORES.tinta).font('Helvetica').fontSize(10.5);
  const alturaValor = doc.heightOfString(valor, { width: largura });
  doc.text(valor, x, y + 11, { width: largura });
  return 11 + alturaValor;
}

/** Linha divisoria horizontal fina. Retorna o `y` logo abaixo. */
export function divisoria(doc: DocumentoPdf, y: number): number {
  const { esquerda, direita } = area(doc);
  doc.save();
  doc.moveTo(esquerda, y).lineTo(direita, y).lineWidth(1).stroke(CORES.linha);
  doc.restore();
  return y + 1;
}

/**
 * Bloco destacado (fundo suave + barra lateral na cor da marca) com um rotulo
 * e um texto longo. Usado para a descricao do problema na OS. Retorna o `y`
 * ao fim do bloco.
 */
export function blocoDestacado(doc: DocumentoPdf, y: number, rotulo: string, texto: string): number {
  const { esquerda, largura } = area(doc);
  const padX = 14;
  const padY = 11;
  const larguraBarra = 3;
  const larguraTexto = largura - padX * 2 - larguraBarra;

  doc.font('Helvetica').fontSize(10);
  const alturaTexto = doc.heightOfString(texto, { width: larguraTexto });
  const alturaRotulo = 13;
  const alturaBox = padY * 2 + alturaRotulo + alturaTexto;

  doc.save();
  doc.rect(esquerda, y, largura, alturaBox).fill(CORES.fundoDescricao);
  doc.rect(esquerda, y, larguraBarra, alturaBox).fill(CORES.marca);
  doc.restore();

  const xTexto = esquerda + larguraBarra + padX;
  doc
    .fillColor(CORES.tintaFraca)
    .font('Helvetica')
    .fontSize(8)
    .text(rotulo.toUpperCase(), xTexto, y + padY, { width: larguraTexto });
  doc
    .fillColor(CORES.textoDescricao)
    .font('Helvetica')
    .fontSize(10)
    .text(texto, xTexto, y + padY + alturaRotulo, { width: larguraTexto });

  return y + alturaBox;
}

/** Caixa tracejada com um aviso centralizado (ex.: nota fiscal no recibo). Retorna o `y` abaixo. */
export function caixaAviso(doc: DocumentoPdf, y: number, texto: string): number {
  const { esquerda, largura } = area(doc);
  const padX = 15;
  const padY = 11;
  const larguraTexto = largura - padX * 2;

  doc.font('Helvetica-Oblique').fontSize(9);
  const alturaTexto = doc.heightOfString(texto, { width: larguraTexto, align: 'center' });
  const alturaBox = padY * 2 + alturaTexto;

  doc.save();
  doc.roundedRect(esquerda, y, largura, alturaBox, 8).dash(3, { space: 2 }).stroke(CORES.linha);
  doc.undash();
  doc.restore();

  doc
    .fillColor(CORES.tintaSuave)
    .font('Helvetica-Oblique')
    .fontSize(9)
    .text(texto, esquerda + padX, y + padY, { width: larguraTexto, align: 'center' });

  return y + alturaBox;
}

type LinhaRodape = { texto: string; tipo?: 'forte' | 'italico' | 'normal' };

/** Rodape centralizado, precedido de uma linha divisoria. */
export function rodape(doc: DocumentoPdf, y: number, linhas: LinhaRodape[]): void {
  const { esquerda, largura } = area(doc);
  let yAtual = y + 8;

  doc.save();
  doc.moveTo(esquerda, yAtual).lineTo(esquerda + largura, yAtual).lineWidth(1).stroke(CORES.linha);
  doc.restore();
  yAtual += 11;

  for (const linha of linhas) {
    const tipo = linha.tipo ?? 'normal';
    if (tipo === 'forte') {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(CORES.tintaSuave);
    } else if (tipo === 'italico') {
      doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(CORES.tintaFraca);
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor(CORES.tintaFraca);
    }
    doc.text(linha.texto, esquerda, yAtual, { width: largura, align: 'center' });
    yAtual += tipo === 'forte' ? 13 : 11;
  }
}
