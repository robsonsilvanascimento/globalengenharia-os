import PDFDocument from 'pdfkit';
import {
  area,
  barraTopo,
  blocoDestacado,
  cabecalho,
  campo,
  corDePrioridade,
  corDeStatus,
  CORES,
  divisoria,
  NOME_EMPRESA,
  PRIORIDADE_ROTULO,
  rodape,
  selo,
  STATUS_ROTULO,
  tituloSecao,
} from './pdf-layout';

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

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Gera o PDF da Ordem de Servico entregue ao cliente via WhatsApp na abertura
 * da OS. Layout com a identidade visual da Global Engenharia (ver
 * `pdf-layout.ts`): faixa e logo no topo, numero da OS em cartao destacado,
 * status e prioridade em selos coloridos, e a descricao do problema em bloco
 * destacado. O numero ja vem no formato `OS-AAAA-NNNNNN`, entao o cabecalho
 * usa "Ordem de Servico Nº" sem repetir o prefixo "OS".
 */
export async function gerarPdfOrdemServico(
  dados: DadosPdfOrdemServico,
  opcoes?: OpcoesPdfOrdemServico,
): Promise<Buffer> {
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

      barraTopo(doc);

      let y = cabecalho(doc, {
        rotuloNumero: 'Ordem de Serviço Nº',
        numero: dados.numero,
        caminhoLogo: opcoes?.caminhoLogo,
      });

      // Linha de status/prioridade (selos coloridos) + data de abertura a direita.
      const rotuloStatus = STATUS_ROTULO[dados.status] ?? dados.status;
      const corStatus = corDeStatus(dados.status);
      const larguraSeloStatus = selo(doc, esquerda, y, rotuloStatus, corStatus.fundo, corStatus.texto);

      const corPrioridade = corDePrioridade(dados.prioridade);
      const rotuloPrioridade = `Prioridade ${PRIORIDADE_ROTULO[dados.prioridade] ?? dados.prioridade}`;
      selo(doc, esquerda + larguraSeloStatus + 8, y, rotuloPrioridade, corPrioridade.fundo, corPrioridade.texto);

      doc
        .fillColor(CORES.tintaFraca)
        .font('Helvetica')
        .fontSize(9)
        .text(`Aberta em ${formatarData(dados.criadoEm)}`, esquerda, y + 4, { width: largura, align: 'right' });

      y = divisoria(doc, y + 34) + 18;

      // Dados do Cliente
      y = tituloSecao(doc, y, 'Dados do Cliente');
      const alturaNome = campo(doc, esquerda, y, larguraColuna, 'Nome', dados.clienteNome);
      const alturaTelefone = campo(doc, xColunaDireita, y, larguraColuna, 'Telefone', dados.clienteTelefone);
      y += Math.max(alturaNome, alturaTelefone) + 12;
      if (dados.clienteEmail) {
        y += campo(doc, esquerda, y, largura, 'E-mail', dados.clienteEmail) + 4;
      }

      // Servico Solicitado
      y = tituloSecao(doc, y + 12, 'Serviço Solicitado');
      const alturaCategoria = campo(doc, esquerda, y, larguraColuna, 'Categoria', dados.categoriaNome);
      // Prioridade renderizada como selo colorido (em vez de texto simples).
      doc
        .fillColor(CORES.tintaFraca)
        .font('Helvetica')
        .fontSize(8)
        .text('PRIORIDADE', xColunaDireita, y, { width: larguraColuna });
      selo(
        doc,
        xColunaDireita,
        y + 11,
        PRIORIDADE_ROTULO[dados.prioridade] ?? dados.prioridade,
        corPrioridade.fundo,
        corPrioridade.texto,
      );
      y += Math.max(alturaCategoria, 11 + 16) + 12;

      if (dados.enderecoAtendimento) {
        y += campo(doc, esquerda, y, largura, 'Endereço de atendimento', dados.enderecoAtendimento) + 10;
      }

      y = blocoDestacado(doc, y, 'Descrição do problema', dados.descricaoProblema);

      rodape(doc, y + 6, [
        { texto: NOME_EMPRESA, tipo: 'forte' },
        { texto: 'Documento gerado automaticamente pelo sistema — via WhatsApp', tipo: 'italico' },
        { texto: `Status atual: ${rotuloStatus}`, tipo: 'normal' },
      ]);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
