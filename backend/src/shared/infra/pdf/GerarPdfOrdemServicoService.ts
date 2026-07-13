import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface DadosPdfOrdemServico {
  numero: string;
  criadoEm: Date;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail?: string;
  categoriaNome: string;
  descricaoProblema: string;
  enderecoAtendimento?: string;
  prioridade: string;
  status: string;
}

export interface OpcoesPdfOrdemServico {
  /**
   * Caminho absoluto para o logo, usado apenas em testes para simular a
   * ausencia do arquivo (fallback para cabecalho em texto). Em uso normal,
   * o caminho padrao (assets/brand/logo.png) e resolvido automaticamente.
   */
  caminhoLogo?: string;
}

const NOME_EMPRESA = 'Global Engenharia';
const LARGURA_LOGO = 160;

// __dirname aqui aponta para src/shared/infra/pdf (em dev, via tsx/ts-node) ou
// dist/shared/infra/pdf (em producao, apos `npm run build`). Como o `tsc`
// espelha exatamente a estrutura de pastas de `src` dentro de `dist`
// (rootDir: src, outDir: dist), a profundidade de diretorios e identica nos
// dois casos. Por isso, subir 4 niveis a partir de __dirname sempre leva a
// raiz do pacote backend/, onde vive a pasta assets/ (irma de src/ e dist/).
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

export async function gerarPdfOrdemServico(
  dados: DadosPdfOrdemServico,
  opcoes?: OpcoesPdfOrdemServico,
): Promise<Buffer> {
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

      // Cabecalho: tenta inserir o logo da empresa; se o arquivo nao existir
      // ou a imagem nao puder ser lida, cai no cabecalho apenas em texto.
      const caminhoLogo = opcoes?.caminhoLogo ?? resolverCaminhoPadraoDoLogo();
      let logoInserido = false;
      try {
        // `doc.image()` NAO avanca `doc.y` sozinho quando informado sem x/y
        // (ao contrario de `doc.text()`). Por isso abrimos a imagem primeiro
        // (`openImage`) para calcular a altura proporcional a partir da
        // largura fixa e avancamos o cursor manualmente apos desenha-la —
        // sem isso, o texto seguinte era desenhado por cima do logo.
        // `openImage` existe em tempo de execucao no pdfkit mas nao esta
        // declarado em `@types/pdfkit`; cast pontual e documentado.
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
        doc.fontSize(18).font('Helvetica-Bold').text('Ordem de Servico', { align: 'left' });
      }
      doc.fontSize(11).font('Helvetica').text(NOME_EMPRESA, { align: 'left' });
      doc.moveDown(1);

      // Numero da OS e data de abertura
      doc.fontSize(14).font('Helvetica-Bold').text(`OS #${dados.numero}`);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Data de abertura: ${formatarData(dados.criadoEm)}`);
      doc.moveDown(1);

      // Dados do Cliente
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Cliente');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Nome: ${dados.clienteNome}`);
      doc.text(`Telefone: ${dados.clienteTelefone}`);
      if (dados.clienteEmail) {
        doc.text(`E-mail: ${dados.clienteEmail}`);
      }
      doc.moveDown(1);

      // Servico Solicitado
      doc.fontSize(12).font('Helvetica-Bold').text('Servico Solicitado');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Categoria: ${dados.categoriaNome}`);
      doc.text(`Prioridade: ${dados.prioridade}`);
      if (dados.enderecoAtendimento) {
        doc.text(`Endereco de atendimento: ${dados.enderecoAtendimento}`);
      }
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Descricao do problema:');
      doc.font('Helvetica').text(dados.descricaoProblema);
      doc.moveDown(2);

      // Rodape
      doc
        .fontSize(9)
        .font('Helvetica-Oblique')
        .text('Documento gerado automaticamente pelo sistema — via WhatsApp', {
          align: 'center',
        });
      doc.text(`Status atual da OS: ${dados.status}`, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
