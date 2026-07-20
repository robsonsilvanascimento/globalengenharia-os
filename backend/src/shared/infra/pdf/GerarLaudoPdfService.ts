import PDFDocument from 'pdfkit';
import {
  area,
  barraTopo,
  CORES,
  type DocumentoPdf,
  NOME_EMPRESA,
  resolverCaminhoPadraoDoLogo,
  tituloSecao,
} from './pdf-layout';

export interface DadosLaudoPdf {
  numero: string;
  titulo: string;
  /** Subtitulo/local exibido na capa (ex.: "Predio administrativo - Bloco A"). */
  subtitulo?: string | null;
  /** Rotulo amigavel do tipo (ex.: "SPDA / para-raios (NBR 5419)"). */
  tipoRotulo?: string | null;
  clienteNome?: string | null;
  /** Lista (uma norma por linha) exibida na pagina de sumario. */
  normasAplicaveis?: string | null;
  emitidoEm: Date;
  conteudo: string;
  responsavelNome?: string | null;
  responsavelCrea?: string | null;
  artNumero?: string | null;
  /** Revisao do documento exibida no cabecalho de controle (default "00"). */
  revisao?: string | null;
  /** Fotos do relatorio fotografico (anexadas ao laudo). */
  fotos?: FotoLaudoPdf[];
}

export interface FotoLaudoPdf {
  buffer: Buffer;
  mimeType: string;
  legenda?: string | null;
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// A fonte padrao (Helvetica/WinAnsi) nao cobre simbolos comuns de engenharia
// (ohm, delta, etc.), que sairiam como lixo no PDF. Este saneamento troca os
// mais frequentes por equivalentes seguros e substitui qualquer outro glifo
// fora da faixa suportada por "?", garantindo que o texto digitado pelo
// tecnico nunca apareca corrompido.
const SUBSTITUICOES_SIMBOLO: Record<string, string> = {
  'Ω': 'ohm', // Ω (letra grega omega)
  'Ω': 'ohm', // Ω (sinal de ohm)
  'μ': 'u', //  µ grego (o µ Latin-1 0xB5 e mantido)
  'Δ': 'delta',
  '∆': 'delta',
  '√': 'raiz',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~=',
  '∞': 'infinito',
  '✓': 'OK',
  '✔': 'OK',
  '✗': 'X',
  '✘': 'X',
};

// Codepoints > 0xFF que a codificacao WinAnsi (CP1252) ainda representa
// (aspas curvas, travessoes, bullet, reticencias, euro, etc.).
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018,
  0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function saneio(texto: string): string {
  let resultado = '';
  for (const ch of texto) {
    const substituto = SUBSTITUICOES_SIMBOLO[ch];
    if (substituto !== undefined) {
      resultado += substituto;
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    resultado += cp <= 0xff || CP1252_EXTRA.has(cp) ? ch : '?';
  }
  return resultado;
}

/**
 * Convencao de marcacao do corpo do laudo (texto livre montado no editor):
 * - Linha "1. Objeto" / "6.1 Nao conformidade": vira titulo de secao. Numero
 *   sem ponto (1, 2, 3) e secao principal e entra no sumario; com ponto (6.1)
 *   e subtitulo.
 * - Linha iniciada por "-", "•" ou "a)"/"a.": item de lista.
 * - Linha iniciada por "[NC]": caixa destacada de nao conformidade.
 * - Linha iniciada por "[!]": caixa de atencao.
 * - Demais linhas: paragrafo justificado.
 */
type Bloco =
  | { tipo: 'h1'; numero: string; texto: string }
  | { tipo: 'h2'; numero: string; texto: string }
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'bullet'; texto: string }
  | { tipo: 'nc'; texto: string }
  | { tipo: 'aviso'; texto: string }
  | { tipo: 'tabela'; linhas: string[][] };

interface ItemSumario {
  numero: string;
  texto: string;
}

const RE_HEADING = /^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/;
const RE_BULLET = /^[-•*]\s+(.+)$/;
const RE_BULLET_LETRA = /^[a-z][.)]\s+(.+)$/i;
/** Linha separadora de tabela markdown (ex.: "| --- | --- |"), ignorada. */
const RE_TABELA_SEP = /^\|(\s*:?-{2,}:?\s*\|)+$/;

/** Quebra uma linha "| a | b | c |" em celulas, descartando as bordas. */
function celulasDaLinha(linha: string): string[] {
  return linha
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function analisarConteudo(conteudo: string): { blocos: Bloco[]; sumario: ItemSumario[] } {
  // Saneia o texto inteiro uma vez: preserva quebras de linha, marcadores e
  // acentos, trocando apenas simbolos fora da fonte.
  const linhas = saneio(conteudo).replace(/\r\n/g, '\n').split('\n');
  const blocos: Bloco[] = [];
  const sumario: ItemSumario[] = [];

  // Buffer de linhas de tabela em sequencia, descarregado quando termina o bloco.
  let tabela: string[][] = [];
  const flushTabela = (): void => {
    if (tabela.length > 0) {
      blocos.push({ tipo: 'tabela', linhas: tabela });
      tabela = [];
    }
  };

  for (const bruto of linhas) {
    const linha = bruto.trim();
    if (linha === '') {
      flushTabela();
      continue;
    }

    if (linha.startsWith('|')) {
      if (!RE_TABELA_SEP.test(linha)) tabela.push(celulasDaLinha(linha));
      continue;
    }
    flushTabela();

    if (/^\[nc\]/i.test(linha)) {
      blocos.push({ tipo: 'nc', texto: linha.replace(/^\[nc\]\s*/i, '') });
      continue;
    }
    if (/^\[!\]/.test(linha)) {
      blocos.push({ tipo: 'aviso', texto: linha.replace(/^\[!\]\s*/, '') });
      continue;
    }

    const cabecalhoMatch = RE_HEADING.exec(linha);
    if (cabecalhoMatch && linha.length <= 90) {
      const numero = cabecalhoMatch[1] ?? '';
      const texto = (cabecalhoMatch[2] ?? '').trim();
      if (numero.includes('.')) {
        blocos.push({ tipo: 'h2', numero, texto });
      } else {
        blocos.push({ tipo: 'h1', numero, texto });
        sumario.push({ numero, texto });
      }
      continue;
    }

    const bulletMatch = RE_BULLET.exec(linha) ?? RE_BULLET_LETRA.exec(linha);
    if (bulletMatch) {
      blocos.push({ tipo: 'bullet', texto: (bulletMatch[1] ?? '').trim() });
      continue;
    }

    blocos.push({ tipo: 'paragrafo', texto: linha });
  }

  flushTabela();
  return { blocos, sumario };
}

const CORES_NC = { fundo: '#FBE4E1', barra: '#C0392B', rotulo: 'NÃO CONFORMIDADE' };
const CORES_AVISO = { fundo: '#FBEFD6', barra: '#A9700A', rotulo: 'ATENÇÃO' };

/**
 * Gera o PDF do laudo tecnico com a estrutura de um relatorio de inspecao
 * profissional: capa, cabecalho de controle (folha x de y) em todas as
 * paginas, sumario automatico a partir das secoes numeradas, corpo formatado
 * (secoes, listas e caixas de nao conformidade) e o bloco de responsabilidade
 * tecnica com a ART.
 */
export async function gerarLaudoPdf(entrada: DadosLaudoPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      // Saneia os campos de metadados (o corpo e saneado no parser e as
      // legendas na galeria). Assim nenhum texto digitado sai corrompido.
      const opcional = (v: string | null | undefined): string | null | undefined =>
        v === null || v === undefined ? v : saneio(v);
      const dados: DadosLaudoPdf = {
        ...entrada,
        numero: saneio(entrada.numero),
        titulo: saneio(entrada.titulo),
        subtitulo: opcional(entrada.subtitulo),
        tipoRotulo: opcional(entrada.tipoRotulo),
        clienteNome: opcional(entrada.clienteNome),
        normasAplicaveis: opcional(entrada.normasAplicaveis),
        responsavelNome: opcional(entrada.responsavelNome),
        responsavelCrea: opcional(entrada.responsavelCrea),
        artNumero: opcional(entrada.artNumero),
      };

      const doc: DocumentoPdf = new PDFDocument({
        size: 'A4',
        margins: { top: 104, bottom: 54, left: 50, right: 50 },
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const { esquerda, direita, largura } = area(doc);
      const limiteInferior = (): number => doc.page.height - doc.page.margins.bottom - 18;

      const novaPagina = (): number => {
        doc.addPage();
        return doc.page.margins.top;
      };
      const garantir = (y: number, altura: number): number => {
        return y + altura > limiteInferior() ? novaPagina() : y;
      };

      // ---------- Corpo: primitivas de bloco ----------
      const desenharH1 = (y: number, numero: string, texto: string): number => {
        const rotulo = `${numero}.  ${texto.toUpperCase()}`;
        doc.font('Helvetica-Bold').fontSize(12.5);
        const altura = doc.heightOfString(rotulo, { width: largura });
        y = garantir(y, altura + 20) + 8;
        doc.fillColor(CORES.marca).text(rotulo, esquerda, y, { width: largura });
        y += altura + 5;
        doc.save();
        doc.moveTo(esquerda, y).lineTo(direita, y).lineWidth(1).stroke(CORES.marca);
        doc.restore();
        return y + 9;
      };

      const desenharH2 = (y: number, numero: string, texto: string): number => {
        const rotulo = `${numero}  ${texto}`;
        doc.font('Helvetica-Bold').fontSize(10.8);
        const altura = doc.heightOfString(rotulo, { width: largura });
        y = garantir(y, altura + 10) + 5;
        doc.fillColor(CORES.marcaEscura).text(rotulo, esquerda, y, { width: largura });
        return y + altura + 5;
      };

      const desenharParagrafo = (y: number, texto: string): number => {
        doc.font('Helvetica').fontSize(10.5).fillColor(CORES.tinta);
        const altura = doc.heightOfString(texto, { width: largura, align: 'justify' });
        y = garantir(y, altura);
        doc.text(texto, esquerda, y, { width: largura, align: 'justify' });
        return y + altura + 6;
      };

      const desenharBullet = (y: number, texto: string): number => {
        const recuo = 16;
        const larguraTexto = largura - recuo;
        doc.font('Helvetica').fontSize(10.5).fillColor(CORES.tinta);
        const altura = doc.heightOfString(texto, { width: larguraTexto });
        y = garantir(y, altura + 2);
        doc.save();
        doc.circle(esquerda + 4, y + 6, 1.7).fill(CORES.marca);
        doc.restore();
        doc.fillColor(CORES.tinta).text(texto, esquerda + recuo, y, { width: larguraTexto });
        return y + altura + 5;
      };

      const desenharCaixa = (
        y: number,
        texto: string,
        cores: { fundo: string; barra: string; rotulo: string },
      ): number => {
        const padX = 12;
        const padY = 9;
        const larguraBarra = 3;
        const larguraTexto = largura - padX * 2 - larguraBarra;
        const alturaRotulo = 12;
        doc.font('Helvetica').fontSize(10);
        const alturaTexto = doc.heightOfString(texto, { width: larguraTexto });
        const alturaBox = padY * 2 + alturaRotulo + alturaTexto;
        y = garantir(y, alturaBox + 8);

        doc.save();
        doc.rect(esquerda, y, largura, alturaBox).fill(cores.fundo);
        doc.rect(esquerda, y, larguraBarra, alturaBox).fill(cores.barra);
        doc.restore();

        const xTexto = esquerda + larguraBarra + padX;
        doc.fillColor(cores.barra).font('Helvetica-Bold').fontSize(8).text(cores.rotulo, xTexto, y + padY, { width: larguraTexto });
        doc.fillColor(CORES.tinta).font('Helvetica').fontSize(10).text(texto, xTexto, y + padY + alturaRotulo, { width: larguraTexto });
        return y + alturaBox + 8;
      };

      // Tabela de dados/medicoes. Primeira linha e o cabecalho (fundo da marca).
      // Colunas de largura igual; altura da linha ajustada ao maior texto; o
      // cabecalho e repetido quando a tabela avanca para a proxima pagina.
      const desenharTabela = (yInicial: number, linhas: string[][]): number => {
        const padCel = 5;
        const nCols = Math.max(...linhas.map((l) => l.length));
        const larguraCol = largura / nCols;

        const alturaDaLinha = (celulas: string[], negrito: boolean): number => {
          doc.font(negrito ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
          let maior = 0;
          for (let c = 0; c < nCols; c += 1) {
            const alturaTexto = doc.heightOfString(celulas[c] ?? '', { width: larguraCol - padCel * 2 });
            if (alturaTexto > maior) maior = alturaTexto;
          }
          return maior + padCel * 2;
        };

        const desenharLinha = (y: number, celulas: string[], indice: number): number => {
          const ehCabecalho = indice === 0;
          const altura = alturaDaLinha(celulas, ehCabecalho);
          doc.save();
          if (ehCabecalho) {
            doc.rect(esquerda, y, largura, altura).fill(CORES.marca);
          } else if (indice % 2 === 0) {
            doc.rect(esquerda, y, largura, altura).fill(CORES.marcaSuave);
          }
          doc.restore();
          doc.save();
          doc.lineWidth(0.5).strokeColor(CORES.linha);
          doc.rect(esquerda, y, largura, altura).stroke();
          for (let c = 1; c < nCols; c += 1) {
            doc.moveTo(esquerda + larguraCol * c, y).lineTo(esquerda + larguraCol * c, y + altura).stroke();
          }
          doc.restore();
          for (let c = 0; c < nCols; c += 1) {
            doc
              .font(ehCabecalho ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(9)
              .fillColor(ehCabecalho ? CORES.branco : CORES.tinta)
              .text(celulas[c] ?? '', esquerda + larguraCol * c + padCel, y + padCel, { width: larguraCol - padCel * 2 });
          }
          return y + altura;
        };

        let y = garantir(yInicial + 4, alturaDaLinha(linhas[0] ?? [], true) + 24);
        const cabecalho = linhas[0] ?? [];
        y = desenharLinha(y, cabecalho, 0);
        for (let i = 1; i < linhas.length; i += 1) {
          const celulas = linhas[i] ?? [];
          const altura = alturaDaLinha(celulas, false);
          if (y + altura > limiteInferior()) {
            y = novaPagina();
            y = desenharLinha(y, cabecalho, 0); // repete o cabecalho na nova pagina
          }
          y = desenharLinha(y, celulas, i);
        }
        return y + 10;
      };

      // Relatorio fotografico: galeria em 2 colunas, cada foto encaixada numa
      // moldura de tamanho fixo (preservando a proporcao) com a legenda abaixo.
      // Quebra de pagina automatica quando a proxima linha nao cabe. Uma foto
      // corrompida vira um aviso na celula em vez de derrubar o PDF.
      const desenharGaleriaFotos = (yInicial: number, numeroSecao: string, fotos: FotoLaudoPdf[]): number => {
        let y = desenharH1(yInicial, numeroSecao, 'Relatório Fotográfico');

        const gap = 14;
        const colLargura = (largura - gap) / 2;
        const alturaImagem = 150;
        const alturaLegenda = 22;
        const alturaCelula = alturaImagem + alturaLegenda + 6;

        for (let i = 0; i < fotos.length; i += 2) {
          if (y + alturaCelula > limiteInferior()) y = novaPagina();
          const linha = fotos.slice(i, i + 2);
          linha.forEach((foto, coluna) => {
            const x = esquerda + coluna * (colLargura + gap);
            const numero = i + coluna + 1;

            doc.save();
            doc.rect(x, y, colLargura, alturaImagem).lineWidth(0.8).stroke(CORES.linha);
            doc.restore();
            try {
              doc.image(foto.buffer, x + 2, y + 2, {
                fit: [colLargura - 4, alturaImagem - 4],
                align: 'center',
                valign: 'center',
              });
            } catch {
              doc
                .font('Helvetica-Oblique')
                .fontSize(8)
                .fillColor(CORES.tintaFraca)
                .text('Imagem indisponível', x + 6, y + alturaImagem / 2 - 4, { width: colLargura - 12, align: 'center' });
            }

            const legenda = `Foto ${numero}${foto.legenda ? ` — ${saneio(foto.legenda)}` : ''}`;
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(CORES.tintaSuave)
              .text(legenda, x, y + alturaImagem + 4, { width: colLargura, align: 'center', height: alturaLegenda, ellipsis: true });
          });
          y += alturaCelula;
        }
        return y + 6;
      };

      // ---------- Capa ----------
      const desenharCapa = (): void => {
        let y = doc.page.margins.top + 4;
        try {
          const abrir = (
            doc as unknown as { openImage: (src: string) => { width: number; height: number } }
          ).openImage.bind(doc);
          const img = abrir(resolverCaminhoPadraoDoLogo());
          const larguraLogo = 190;
          const alturaLogo = (larguraLogo / img.width) * img.height;
          doc.image(resolverCaminhoPadraoDoLogo(), esquerda + (largura - larguraLogo) / 2, y, { width: larguraLogo });
          y += alturaLogo + 34;
        } catch {
          doc.font('Helvetica-Bold').fontSize(20).fillColor(CORES.marcaEscura).text(NOME_EMPRESA, esquerda, y, { width: largura, align: 'center' });
          y += 44;
        }

        doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.marca).text('LAUDO TÉCNICO', esquerda, y, {
          width: largura,
          align: 'center',
          characterSpacing: 2,
        });
        y += 30;

        doc.font('Helvetica-Bold').fontSize(21).fillColor(CORES.tinta);
        const alturaTitulo = doc.heightOfString(dados.titulo, { width: largura, align: 'center' });
        doc.text(dados.titulo, esquerda, y, { width: largura, align: 'center' });
        y += alturaTitulo + 12;

        if (dados.subtitulo?.trim()) {
          doc.font('Helvetica').fontSize(13).fillColor(CORES.tintaSuave);
          const alturaSub = doc.heightOfString(dados.subtitulo, { width: largura, align: 'center' });
          doc.text(dados.subtitulo, esquerda, y, { width: largura, align: 'center' });
          y += alturaSub + 10;
        }

        const larguraRegua = 90;
        doc.save();
        doc
          .moveTo(esquerda + (largura - larguraRegua) / 2, y + 4)
          .lineTo(esquerda + (largura + larguraRegua) / 2, y + 4)
          .lineWidth(2)
          .stroke(CORES.marca);
        doc.restore();
        y += 18;

        if (dados.tipoRotulo?.trim()) {
          doc.font('Helvetica').fontSize(11).fillColor(CORES.tintaSuave).text(dados.tipoRotulo, esquerda, y, {
            width: largura,
            align: 'center',
          });
        }

        // Cartao de dados-chave no rodape da capa.
        const cardAltura = 132;
        const cardY = doc.page.height - doc.page.margins.bottom - cardAltura - 6;
        doc.save();
        doc.roundedRect(esquerda, cardY, largura, cardAltura, 10).fill(CORES.marcaSuave);
        doc.restore();

        const padX = 22;
        const colLargura = (largura - padX * 2 - 24) / 2;
        const xc1 = esquerda + padX;
        const xc2 = xc1 + colLargura + 24;
        const linhaCard = (x: number, yy: number, rotulo: string, valor: string): void => {
          doc.font('Helvetica').fontSize(7.5).fillColor(CORES.tintaFraca).text(rotulo.toUpperCase(), x, yy, { width: colLargura });
          doc.font('Helvetica-Bold').fontSize(10.5).fillColor(CORES.tinta).text(valor, x, yy + 10, { width: colLargura });
        };
        let yc = cardY + 18;
        linhaCard(xc1, yc, 'Cliente / Contratante', dados.clienteNome?.trim() || '—');
        linhaCard(xc2, yc, 'Número do laudo', dados.numero);
        yc += 38;
        linhaCard(xc1, yc, 'Responsável técnico', dados.responsavelNome?.trim() || 'A preencher');
        linhaCard(xc2, yc, 'Data de emissão', formatarData(dados.emitidoEm));
        yc += 38;
        linhaCard(xc1, yc, 'CREA', dados.responsavelCrea?.trim() || 'A preencher');
        linhaCard(xc2, yc, 'ART nº', dados.artNumero?.trim() || 'A preencher');
      };

      // ---------- Sumario + normas ----------
      const desenharSumario = (sumario: ItemSumario[]): void => {
        doc.addPage();
        let y = doc.page.margins.top;
        y = tituloSecao(doc, y, 'Sumário') + 4;

        if (sumario.length === 0) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor(CORES.tintaFraca).text(
            'As seções aparecem aqui automaticamente quando numeradas no corpo do laudo (ex.: "1. Objeto").',
            esquerda,
            y,
            { width: largura },
          );
          y += 26;
        } else {
          for (const item of sumario) {
            y = garantir(y, 20);
            doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.marca).text(`${item.numero}.`, esquerda, y, { width: 26, lineBreak: false });
            doc.font('Helvetica').fontSize(11).fillColor(CORES.tinta).text(item.texto, esquerda + 28, y, { width: largura - 28 });
            y += 20;
          }
          y += 6;
        }

        if (dados.normasAplicaveis?.trim()) {
          y += 10;
          y = tituloSecao(doc, garantir(y, 40), 'Normas e documentos de referência') + 2;
          const normas = dados.normasAplicaveis
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((linha) => linha.trim().replace(/^[-•*]\s*/, ''))
            .filter(Boolean);
          for (const norma of normas) {
            const larguraTexto = largura - 16;
            doc.font('Helvetica').fontSize(10).fillColor(CORES.tinta);
            const altura = doc.heightOfString(norma, { width: larguraTexto });
            y = garantir(y, altura + 2);
            doc.save();
            doc.circle(esquerda + 3, y + 6, 1.6).fill(CORES.marca);
            doc.restore();
            doc.fillColor(CORES.tinta).text(norma, esquerda + 14, y, { width: larguraTexto });
            y += altura + 5;
          }
        }
      };

      // ---------- Responsabilidade tecnica ----------
      const desenharResponsabilidade = (yInicial: number): void => {
        let y = garantir(yInicial + 12, 210);
        y = tituloSecao(doc, y, 'Responsabilidade Técnica') + 2;

        const linhas: Array<[string, string]> = [
          ['Responsável técnico', dados.responsavelNome?.trim() || '[a preencher]'],
          ['Registro no CREA', dados.responsavelCrea?.trim() || '[a preencher]'],
          ['Nº da ART', dados.artNumero?.trim() || '[a preencher]'],
          ['Data de emissão', formatarData(dados.emitidoEm)],
        ];
        for (const [rotulo, valor] of linhas) {
          doc.font('Helvetica').fontSize(8).fillColor(CORES.tintaFraca).text(rotulo.toUpperCase(), esquerda, y, { width: largura });
          doc.font('Helvetica').fontSize(10.5).fillColor(CORES.tinta).text(valor, esquerda, y + 11, { width: largura });
          y += 30;
        }

        y += 30;
        doc.save();
        doc.moveTo(esquerda, y).lineTo(esquerda + 280, y).lineWidth(1).stroke('#888888');
        doc.restore();
        doc.font('Helvetica').fontSize(9).fillColor(CORES.tintaFraca).text('Assinatura do responsável técnico', esquerda, y + 6);
      };

      // ---------- Cabecalho de controle (todas as paginas) ----------
      const desenharCabecalhoControle = (folha: number, total: number): void => {
        const topo = 28;
        const altura = 60;
        const larguraDir = 158;
        const larguraLogo = 150;
        const xDir = direita - larguraDir;
        const xMeio = esquerda + larguraLogo;

        doc.save();
        doc.lineWidth(0.8).strokeColor(CORES.linha);
        doc.rect(esquerda, topo, largura, altura).stroke();
        doc.moveTo(xMeio, topo).lineTo(xMeio, topo + altura).stroke();
        doc.moveTo(xDir, topo).lineTo(xDir, topo + altura).stroke();
        doc.restore();

        // Cel. esquerda: nome da empresa (texto, para nao redecodificar o logo por pagina).
        doc.font('Helvetica-Bold').fontSize(12).fillColor(CORES.marcaEscura).text(NOME_EMPRESA.toUpperCase(), esquerda + 10, topo + altura / 2 - 13, {
          width: larguraLogo - 20,
          align: 'center',
        });

        // Cel. central: tipo do documento.
        const xMeioTexto = xMeio + 8;
        const larguraMeio = xDir - xMeio - 16;
        doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.tinta).text('LAUDO TÉCNICO', xMeioTexto, topo + 15, {
          width: larguraMeio,
          align: 'center',
        });
        if (dados.tipoRotulo?.trim()) {
          doc.font('Helvetica').fontSize(7.5).fillColor(CORES.tintaSuave).text(dados.tipoRotulo, xMeioTexto, topo + 33, {
            width: larguraMeio,
            align: 'center',
          });
        }

        // Cel. direita: 4 linhas (Nº / FOLHA / DATA / REV).
        const dadosDir: Array<[string, string]> = [
          ['Nº', dados.numero],
          ['FOLHA', `${folha} de ${total}`],
          ['DATA', formatarData(dados.emitidoEm)],
          ['REV', dados.revisao?.trim() || '00'],
        ];
        const alturaLinha = altura / 4;
        doc.save();
        doc.lineWidth(0.5).strokeColor(CORES.linha);
        for (let i = 1; i < 4; i += 1) {
          doc.moveTo(xDir, topo + alturaLinha * i).lineTo(direita, topo + alturaLinha * i).stroke();
        }
        doc.restore();
        dadosDir.forEach(([rotulo, valor], i) => {
          const yy = topo + alturaLinha * i + alturaLinha / 2 - 4;
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(CORES.tintaFraca).text(rotulo, xDir + 8, yy, { width: 36, lineBreak: false });
          doc.font('Helvetica').fontSize(8).fillColor(CORES.tinta).text(valor, xDir + 46, yy, { width: larguraDir - 54, lineBreak: false });
        });
      };

      const desenharRodapePagina = (): void => {
        const y = doc.page.height - doc.page.margins.bottom + 10;
        doc.save();
        doc.moveTo(esquerda, y).lineTo(direita, y).lineWidth(0.5).stroke(CORES.linha);
        doc.restore();
        // Desenhar texto abaixo da margem inferior faria o pdfkit paginar (e
        // criar folhas fantasma). Zera a margem inferior so durante o texto do
        // rodape para manter tudo na propria pagina.
        const margemAnterior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7.5).fillColor(CORES.tintaFraca).text(
          `${NOME_EMPRESA} · Documento emitido eletronicamente. A ART é registrada no CREA pelo responsável técnico.`,
          esquerda,
          y + 4,
          { width: largura, align: 'center', lineBreak: false },
        );
        doc.page.margins.bottom = margemAnterior;
      };

      // ---------- Montagem ----------
      const { blocos, sumario } = analisarConteudo(dados.conteudo);
      const fotos = dados.fotos ?? [];

      // O relatorio fotografico entra como ultima secao numerada, na sequencia
      // das secoes principais do corpo, e tambem no sumario.
      let numeroSecaoFotos = '';
      if (fotos.length > 0) {
        const maiorNumero = sumario.reduce((max, item) => {
          const n = Number.parseInt(item.numero, 10);
          return Number.isNaN(n) ? max : Math.max(max, n);
        }, 0);
        numeroSecaoFotos = String(maiorNumero + 1);
        sumario.push({ numero: numeroSecaoFotos, texto: 'Relatório Fotográfico' });
      }

      desenharCapa();
      desenharSumario(sumario);

      doc.addPage();
      let y = doc.page.margins.top;
      for (const bloco of blocos) {
        switch (bloco.tipo) {
          case 'h1':
            y = desenharH1(y, bloco.numero, bloco.texto);
            break;
          case 'h2':
            y = desenharH2(y, bloco.numero, bloco.texto);
            break;
          case 'bullet':
            y = desenharBullet(y, bloco.texto);
            break;
          case 'nc':
            y = desenharCaixa(y, bloco.texto, CORES_NC);
            break;
          case 'aviso':
            y = desenharCaixa(y, bloco.texto, CORES_AVISO);
            break;
          case 'tabela':
            y = desenharTabela(y, bloco.linhas);
            break;
          default:
            y = desenharParagrafo(y, bloco.texto);
        }
      }

      if (fotos.length > 0) {
        y = desenharGaleriaFotos(y, numeroSecaoFotos, fotos);
      }

      desenharResponsabilidade(y);

      // Carimba a faixa da marca, o cabecalho de controle e o rodape em todas
      // as paginas so no final, quando ja se conhece o total de folhas.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        barraTopo(doc);
        desenharCabecalhoControle(i - range.start + 1, range.count);
        desenharRodapePagina();
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
