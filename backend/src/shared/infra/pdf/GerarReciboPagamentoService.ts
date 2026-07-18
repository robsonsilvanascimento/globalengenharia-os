import PDFDocument from 'pdfkit';
import {
  area,
  barraTopo,
  cabecalho,
  caixaAviso,
  campo,
  CORES,
  divisoria,
  type DocumentoPdf,
  NOME_EMPRESA,
  rodape,
  tituloSecao,
} from './pdf-layout';

export interface DadosReciboPagamento {
  numeroOS: string;
  clienteNome: string;
  clienteTelefone: string;
  valor: number;
  tipoPagamento: 'pix_automatico' | 'manual';
  pagoEm: Date;
}

const LABEL_TIPO_PAGAMENTO: Record<DadosReciboPagamento['tipoPagamento'], string> = {
  pix_automatico: 'Pix',
  manual: 'Manual (dinheiro, transferência ou outro)',
};

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Bloco de confirmacao do pagamento: faixa verde com um selo de "check"
 * (desenhado a mao com um circulo + risco, para nao depender do glyph "✓",
 * que fica fora da faixa WinAnsi das fontes padrao do pdfkit) e o valor pago
 * em destaque a direita. Retorna o `y` ao fim do bloco.
 */
function blocoConfirmacao(
  doc: DocumentoPdf,
  y: number,
  info: { valor: string; quando: string; forma: string },
): number {
  const { esquerda, direita, largura } = area(doc);
  const altura = 60;

  doc.save();
  doc.roundedRect(esquerda, y, largura, altura, 10).fillAndStroke(CORES.okSuave, CORES.okBorda);
  doc.restore();

  // Selo de check: circulo verde + risco branco desenhado com dois segmentos.
  const cx = esquerda + 26;
  const cy = y + 24;
  doc.save();
  doc.circle(cx, cy, 9).fill(CORES.ok);
  doc.lineWidth(1.6).lineJoin('round').lineCap('round');
  doc
    .moveTo(cx - 4, cy)
    .lineTo(cx - 1, cy + 3)
    .lineTo(cx + 4.5, cy - 3.5)
    .stroke(CORES.branco);
  doc.restore();

  doc
    .fillColor(CORES.ok)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('PAGAMENTO CONFIRMADO', esquerda + 46, y + 15);
  doc
    .fillColor(CORES.tintaSuave)
    .font('Helvetica')
    .fontSize(9.5)
    .text(`Recebido em ${info.quando} · via ${info.forma}`, esquerda + 46, y + 31, { width: largura - 210 });

  doc.fillColor(CORES.ok).font('Helvetica-Bold').fontSize(24);
  const larguraValor = doc.widthOfString(info.valor);
  doc.text(info.valor, direita - 20 - larguraValor, y + 18, { lineBreak: false });

  return y + altura;
}

/**
 * Gera o PDF do recibo de pagamento de uma OS, entregue ao cliente via
 * WhatsApp assim que o pagamento e confirmado (Pix automatico ou manual).
 * Segue a identidade visual do documento de OS (ver `pdf-layout.ts`). Nao
 * substitui nota fiscal — a caixa de aviso orienta o cliente a solicitar a
 * nota ao atendente do escritorio caso precise, ja que a emissao fiscal
 * continua sendo um processo manual, fora do sistema.
 */
export async function gerarReciboPagamento(dados: DadosReciboPagamento): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const { esquerda, largura } = area(doc);
      const larguraColuna = (largura - 20) / 2;
      const xColunaDireita = esquerda + larguraColuna + 20;

      const valorFormatado = formatarValor(dados.valor);
      const formaPagamento = LABEL_TIPO_PAGAMENTO[dados.tipoPagamento];
      const dataFormatada = formatarData(dados.pagoEm);

      barraTopo(doc);

      let y = cabecalho(doc, { rotuloNumero: 'Recibo — OS Nº', numero: dados.numeroOS });

      y = blocoConfirmacao(doc, y, { valor: valorFormatado, quando: dataFormatada, forma: formaPagamento }) + 18;

      y = divisoria(doc, y) + 18;

      // Cliente
      y = tituloSecao(doc, y, 'Cliente');
      const alturaNome = campo(doc, esquerda, y, larguraColuna, 'Nome', dados.clienteNome);
      const alturaTelefone = campo(doc, xColunaDireita, y, larguraColuna, 'Telefone', dados.clienteTelefone);
      y += Math.max(alturaNome, alturaTelefone) + 12;

      // Detalhes do Pagamento
      y = tituloSecao(doc, y + 12, 'Detalhes do Pagamento');
      const alturaValor = campo(doc, esquerda, y, larguraColuna, 'Valor pago', valorFormatado);
      const alturaForma = campo(doc, xColunaDireita, y, larguraColuna, 'Forma de pagamento', formaPagamento);
      y += Math.max(alturaValor, alturaForma) + 12;
      const alturaData = campo(doc, esquerda, y, larguraColuna, 'Data do pagamento', dataFormatada);
      const alturaOS = campo(doc, xColunaDireita, y, larguraColuna, 'Ordem de serviço', dados.numeroOS);
      y += Math.max(alturaData, alturaOS) + 16;

      y = caixaAviso(
        doc,
        y,
        'Este recibo comprova o pagamento recebido e não substitui nota fiscal. Caso precise de nota fiscal, solicite ao atendente do escritório.',
      );

      rodape(doc, y + 6, [
        { texto: NOME_EMPRESA, tipo: 'forte' },
        { texto: 'Documento gerado automaticamente pelo sistema', tipo: 'italico' },
      ]);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
