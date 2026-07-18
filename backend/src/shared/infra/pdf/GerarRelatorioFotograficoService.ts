import PDFDocument from 'pdfkit';
import {
  area,
  barraTopo,
  cabecalho,
  CORES,
  type DocumentoPdf,
  NOME_EMPRESA,
  rodape,
  tituloSecao,
} from './pdf-layout';

export interface FotoRelatorio {
  base64: string;
  mimeType: string;
  legenda: string | null;
  /** `null` (fotos antigas sem marcacao) e tratado como "depois". */
  momento: 'antes' | 'depois' | null;
}

export interface DadosRelatorioFotografico {
  numeroOS: string;
  clienteNome: string;
  emitidoEm: Date;
  fotos: FotoRelatorio[];
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Converte um base64 (com ou sem prefixo data URI) em Buffer para o pdfkit. */
function base64ParaBuffer(base64: string): Buffer {
  const virgula = base64.indexOf(',');
  const puro = base64.startsWith('data:') && virgula >= 0 ? base64.slice(virgula + 1) : base64;
  return Buffer.from(puro, 'base64');
}

const RESERVA_RODAPE = 70;
const GAP = 14;
const ALTURA_IMAGEM = 128;
const ALTURA_LEGENDA = 16;
const ALTURA_CELULA = ALTURA_IMAGEM + ALTURA_LEGENDA + 8;

/**
 * Desenha uma galeria de fotos em grade de 2 colunas, com quebra de pagina
 * automatica quando a proxima linha nao cabe. Cada foto e encaixada (`fit`)
 * numa moldura de tamanho fixo, preservando a proporcao original. Uma foto
 * com base64 corrompido nao derruba o relatorio: cai para um aviso na celula.
 * Retorna o `y` ao fim da galeria.
 */
function desenharGaleria(
  doc: DocumentoPdf,
  yInicial: number,
  titulo: string,
  fotos: FotoRelatorio[],
): number {
  const { esquerda, largura } = area(doc);
  let y = tituloSecao(doc, yInicial, titulo);

  if (fotos.length === 0) {
    doc
      .fillColor(CORES.tintaFraca)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text('Nenhuma foto registrada nesta etapa.', esquerda, y);
    return y + 18;
  }

  const larguraColuna = (largura - GAP) / 2;
  let coluna = 0;

  for (const foto of fotos) {
    if (coluna === 0 && y + ALTURA_CELULA > doc.page.height - RESERVA_RODAPE) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    const x = esquerda + coluna * (larguraColuna + GAP);

    doc.save();
    doc.roundedRect(x, y, larguraColuna, ALTURA_IMAGEM, 6).fillAndStroke('#F4F6F9', CORES.linha);
    doc.restore();

    try {
      const buffer = base64ParaBuffer(foto.base64);
      doc.image(buffer, x + 4, y + 4, {
        fit: [larguraColuna - 8, ALTURA_IMAGEM - 8],
        align: 'center',
        valign: 'center',
      });
    } catch {
      doc
        .fillColor(CORES.tintaFraca)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text('Imagem indisponível', x, y + ALTURA_IMAGEM / 2 - 4, { width: larguraColuna, align: 'center' });
    }

    doc
      .fillColor(CORES.tintaSuave)
      .font('Helvetica')
      .fontSize(8.5)
      .text(foto.legenda ?? '', x, y + ALTURA_IMAGEM + 4, {
        width: larguraColuna,
        align: 'center',
        height: ALTURA_LEGENDA,
        ellipsis: true,
      });

    coluna += 1;
    if (coluna === 2) {
      coluna = 0;
      y += ALTURA_CELULA;
    }
  }

  if (coluna === 1) {
    y += ALTURA_CELULA;
  }

  return y + 6;
}

/**
 * Gera o PDF do relatorio fotografico comparativo (antes/depois) de uma OS.
 * Fotos com `momento === 'antes'` vao para a secao "Antes"; as demais
 * (`'depois'` ou sem marcacao) vao para "Depois". Segue a identidade visual
 * dos demais documentos (ver `pdf-layout.ts`).
 */
export async function gerarRelatorioFotografico(
  dados: DadosRelatorioFotografico,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const { esquerda, largura } = area(doc);

      barraTopo(doc);
      let y = cabecalho(doc, { rotuloNumero: 'Relatório Fotográfico — OS Nº', numero: dados.numeroOS });

      doc
        .fillColor(CORES.tintaFraca)
        .font('Helvetica')
        .fontSize(9)
        .text(
          `Cliente: ${dados.clienteNome}    ·    Emitido em ${formatarData(dados.emitidoEm)}`,
          esquerda,
          y,
          { width: largura },
        );
      y += 22;

      const antes = dados.fotos.filter((foto) => foto.momento === 'antes');
      const depois = dados.fotos.filter((foto) => foto.momento !== 'antes');

      y = desenharGaleria(doc, y, 'Antes', antes);
      y = desenharGaleria(doc, y + 8, 'Depois', depois);

      rodape(doc, y + 6, [
        { texto: NOME_EMPRESA, tipo: 'forte' },
        { texto: 'Relatório gerado automaticamente pelo sistema', tipo: 'italico' },
      ]);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
