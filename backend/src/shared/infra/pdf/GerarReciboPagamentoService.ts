import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface DadosReciboPagamento {
  numeroOS: string;
  clienteNome: string;
  clienteTelefone: string;
  valor: number;
  tipoPagamento: 'pix_automatico' | 'manual';
  pagoEm: Date;
}

const NOME_EMPRESA = 'Global Engenharia';
const LARGURA_LOGO = 160;

const LABEL_TIPO_PAGAMENTO: Record<DadosReciboPagamento['tipoPagamento'], string> = {
  pix_automatico: 'Pix',
  manual: 'Manual (dinheiro, transferência ou outro)',
};

// Mesma logica de resolucao de caminho usada em GerarPdfOrdemServicoService:
// __dirname aponta para src/shared/infra/pdf (dev) ou dist/shared/infra/pdf
// (producao com estrutura espelhada), 4 niveis acima fica a raiz do pacote
// backend/, onde vive assets/brand/logo.png.
function resolverCaminhoPadraoDoLogo(): string {
  return path.join(__dirname, '..', '..', '..', '..', 'assets', 'brand', 'logo.png');
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

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Gera o PDF do recibo de pagamento de uma OS, entregue ao cliente via
 * WhatsApp assim que o pagamento e confirmado (Pix automatico ou manual).
 * Nao substitui nota fiscal — o rodape orienta o cliente a solicitar a nota
 * ao atendente do escritorio caso precise, ja que a emissao fiscal continua
 * sendo um processo manual, fora do sistema.
 */
export async function gerarReciboPagamento(dados: DadosReciboPagamento): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', (err: Error) => {
        reject(err);
      });

      const caminhoLogo = resolverCaminhoPadraoDoLogo();
      let logoInserido = false;
      try {
        const abrirImagem = (doc as unknown as {
          openImage: (src: string) => { width: number; height: number };
        }).openImage.bind(doc);
        const imagemLogo = abrirImagem(caminhoLogo);
        const alturaLogo = (LARGURA_LOGO / imagemLogo.width) * imagemLogo.height;
        const xLogo = doc.x;
        const yLogo = doc.y;
        doc.image(caminhoLogo, xLogo, yLogo, { width: LARGURA_LOGO });
        doc.y = yLogo + alturaLogo;
        logoInserido = true;
      } catch {
        logoInserido = false;
      }

      if (logoInserido) {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(18).font('Helvetica-Bold').text('Recibo de Pagamento', { align: 'left' });
      }
      doc.fontSize(11).font('Helvetica').text(NOME_EMPRESA, { align: 'left' });
      doc.moveDown(1);

      doc.fontSize(16).font('Helvetica-Bold').text('Recibo de Pagamento');
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('Ordem de Servico');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(`Numero: ${dados.numeroOS}`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('Cliente');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nome: ${dados.clienteNome}`);
      doc.text(`Telefone: ${dados.clienteTelefone}`);
      doc.moveDown(1);

      doc.fontSize(12).font('Helvetica-Bold').text('Pagamento');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Valor pago: ${formatarValor(dados.valor)}`);
      doc.text(`Forma de pagamento: ${LABEL_TIPO_PAGAMENTO[dados.tipoPagamento]}`);
      doc.text(`Data do pagamento: ${formatarData(dados.pagoEm)}`);
      doc.moveDown(2);

      doc
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text(
          'Este recibo comprova o pagamento recebido e nao substitui nota fiscal. Caso precise de nota fiscal, solicite ao atendente do escritorio.',
          { align: 'center' },
        );
      doc.text('Documento gerado automaticamente pelo sistema', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
