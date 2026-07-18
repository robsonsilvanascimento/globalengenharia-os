import PDFDocument from 'pdfkit';
import {
  area,
  barraTopo,
  cabecalho,
  CORES,
  divisoria,
  type DocumentoPdf,
  NOME_EMPRESA,
  rodape,
  tituloSecao,
} from './pdf-layout';

export interface DadosLaudoPdf {
  numero: string;
  titulo: string;
  clienteNome?: string | null;
  emitidoEm: Date;
  conteudo: string;
  responsavelNome?: string | null;
  responsavelCrea?: string | null;
  artNumero?: string | null;
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const RESERVA_RODAPE = 90;

/**
 * Renderiza o corpo do laudo (texto livre montado no editor). Cada linha do
 * conteudo vira um paragrafo; linhas em branco viram espacamento. Quebra de
 * pagina automatica quando o proximo bloco nao cabe.
 */
function desenharConteudo(doc: DocumentoPdf, yInicial: number, conteudo: string): number {
  const { esquerda, largura } = area(doc);
  let y = yInicial;
  const linhas = conteudo.replace(/\r\n/g, '\n').split('\n');

  for (const linha of linhas) {
    const texto = linha.trim();
    if (texto === '') {
      y += 6;
      continue;
    }

    doc.font('Helvetica').fontSize(10.5).fillColor(CORES.tinta);
    const altura = doc.heightOfString(texto, { width: largura, align: 'justify' });

    if (y + altura > doc.page.height - RESERVA_RODAPE) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    doc.text(texto, esquerda, y, { width: largura, align: 'justify' });
    y += altura + 5;
  }

  return y;
}

function desenharResponsabilidade(doc: DocumentoPdf, yInicial: number, dados: DadosLaudoPdf): number {
  const { esquerda, largura } = area(doc);
  const alturaBloco = 150;

  let y = yInicial;
  if (y + alturaBloco > doc.page.height - RESERVA_RODAPE) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  y = tituloSecao(doc, y + 8, 'Responsabilidade Técnica');

  const linhas: Array<[string, string]> = [
    ['Responsavel tecnico', dados.responsavelNome?.trim() || '[a preencher]'],
    ['Registro CREA', dados.responsavelCrea?.trim() || '[a preencher]'],
    ['Nº da ART', dados.artNumero?.trim() || '[a preencher]'],
    ['Data de emissao', formatarData(dados.emitidoEm)],
  ];

  for (const [rotulo, valor] of linhas) {
    doc.font('Helvetica').fontSize(8).fillColor(CORES.tintaFraca).text(rotulo.toUpperCase(), esquerda, y, { width: largura });
    doc.font('Helvetica').fontSize(10.5).fillColor(CORES.tinta).text(valor, esquerda, y + 11, { width: largura });
    y += 28;
  }

  y += 26;
  doc.save();
  doc.moveTo(esquerda, y).lineTo(esquerda + 260, y).lineWidth(1).stroke('#888888');
  doc.restore();
  doc.font('Helvetica').fontSize(9).fillColor(CORES.tintaFraca).text('Assinatura do Responsavel Tecnico', esquerda, y + 6);

  return y + 24;
}

/**
 * Gera o PDF do laudo tecnico com a identidade visual dos demais documentos
 * (ver `pdf-layout.ts`): cabecalho com logo, titulo e dados, o conteudo
 * montado no editor e o bloco de responsabilidade tecnica com a ART.
 */
export async function gerarLaudoPdf(dados: DadosLaudoPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const { esquerda, largura } = area(doc);

      barraTopo(doc);
      let y = cabecalho(doc, { rotuloNumero: 'Laudo Nº', numero: dados.numero });

      doc.font('Helvetica-Bold').fontSize(15).fillColor(CORES.tinta).text(dados.titulo, esquerda, y, { width: largura });
      y += doc.heightOfString(dados.titulo, { width: largura }) + 6;

      const info = [dados.clienteNome ? `Cliente: ${dados.clienteNome}` : null, `Emitido em ${formatarData(dados.emitidoEm)}`]
        .filter(Boolean)
        .join('    ·    ');
      doc.font('Helvetica').fontSize(9).fillColor(CORES.tintaFraca).text(info, esquerda, y, { width: largura });
      y = divisoria(doc, y + 20) + 16;

      y = desenharConteudo(doc, y, dados.conteudo);
      y = desenharResponsabilidade(doc, y + 10, dados);

      rodape(doc, y + 6, [
        { texto: NOME_EMPRESA, tipo: 'forte' },
        { texto: 'Documento gerado pelo sistema. A ART e registrada no CREA pelo responsavel tecnico.', tipo: 'italico' },
      ]);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
