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

export interface ItemOrcamentoPdf {
  descricao: string;
  valor: number;
}

export interface DadosOrcamentoPdf {
  numeroOS: string;
  clienteNome: string;
  emitidoEm: Date;
  itens: ItemOrcamentoPdf[];
  valorTotal: number;
  observacao?: string | null;
  /** Validade da proposta em dias, mostrada no rodape. */
  validadeDias?: number;
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Desenha a tabela de itens (descricao a esquerda, valor a direita) com
 * cabecalho, linhas zebradas e a linha de total destacada. Retorna o `y` ao
 * fim da tabela.
 */
function desenharTabelaItens(
  doc: DocumentoPdf,
  yInicial: number,
  itens: ItemOrcamentoPdf[],
  valorTotal: number,
): number {
  const { esquerda, largura } = area(doc);
  const colValorLargura = 110;
  const xValor = esquerda + largura - colValorLargura;
  const padX = 12;
  let y = yInicial;

  // Cabecalho da tabela
  doc.save();
  doc.rect(esquerda, y, largura, 22).fill(CORES.marca);
  doc.restore();
  doc.fillColor(CORES.branco).font('Helvetica-Bold').fontSize(9);
  doc.text('DESCRIÇÃO', esquerda + padX, y + 7, { width: largura - colValorLargura - padX });
  doc.text('VALOR', xValor, y + 7, { width: colValorLargura - padX, align: 'right' });
  y += 22;

  // Linhas
  doc.font('Helvetica').fontSize(10);
  itens.forEach((item, indice) => {
    const alturaDescricao = doc.heightOfString(item.descricao, { width: largura - colValorLargura - padX * 2 });
    const alturaLinha = Math.max(22, alturaDescricao + 12);

    if (indice % 2 === 1) {
      doc.save();
      doc.rect(esquerda, y, largura, alturaLinha).fill('#F4F6F9');
      doc.restore();
    }

    doc.fillColor(CORES.tinta).font('Helvetica').fontSize(10);
    doc.text(item.descricao, esquerda + padX, y + 6, { width: largura - colValorLargura - padX * 2 });
    doc.text(formatarValor(item.valor), xValor, y + 6, { width: colValorLargura - padX, align: 'right' });
    y += alturaLinha;
  });

  // Linha do total
  doc.save();
  doc.rect(esquerda, y, largura, 26).fill(CORES.marcaSuave);
  doc.restore();
  doc.fillColor(CORES.marcaEscura).font('Helvetica-Bold').fontSize(11);
  doc.text('TOTAL', esquerda + padX, y + 8, { width: largura - colValorLargura - padX });
  doc.text(formatarValor(valorTotal), xValor, y + 8, { width: colValorLargura - padX, align: 'right' });
  y += 26;

  return y;
}

/**
 * Gera o PDF da proposta/orcamento enviada ao cliente para aprovacao, com a
 * identidade visual dos demais documentos (ver `pdf-layout.ts`): itens
 * detalhados numa tabela e o valor total destacado.
 */
export async function gerarOrcamentoPdf(dados: DadosOrcamentoPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const { esquerda, largura } = area(doc);

      barraTopo(doc);
      let y = cabecalho(doc, { rotuloNumero: 'Orçamento — OS Nº', numero: dados.numeroOS });

      doc
        .fillColor(CORES.tintaFraca)
        .font('Helvetica')
        .fontSize(9)
        .text(`Cliente: ${dados.clienteNome}    ·    Emitido em ${formatarData(dados.emitidoEm)}`, esquerda, y, {
          width: largura,
        });
      y += 24;

      y = tituloSecao(doc, y, 'Itens do Orçamento');
      y = desenharTabelaItens(doc, y, dados.itens, dados.valorTotal);

      if (dados.observacao && dados.observacao.trim()) {
        y += 18;
        y = tituloSecao(doc, y, 'Observações');
        doc.fillColor(CORES.tinta).font('Helvetica').fontSize(10);
        doc.text(dados.observacao, esquerda, y, { width: largura });
        y += doc.heightOfString(dados.observacao, { width: largura });
      }

      y += 18;
      y = divisoria(doc, y) + 10;
      const validade = dados.validadeDias ?? 7;
      doc
        .fillColor(CORES.tintaFraca)
        .font('Helvetica-Oblique')
        .fontSize(9)
        .text(
          `Proposta valida por ${validade} dias a partir da emissao. Valores sujeitos a confirmacao apos vistoria tecnica, quando aplicavel.`,
          esquerda,
          y,
          { width: largura },
        );

      rodape(doc, y + 20, [
        { texto: NOME_EMPRESA, tipo: 'forte' },
        { texto: 'Documento gerado automaticamente pelo sistema', tipo: 'italico' },
      ]);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
