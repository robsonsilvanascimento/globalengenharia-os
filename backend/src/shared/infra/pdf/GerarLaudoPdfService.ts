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
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
  | { tipo: 'aviso'; texto: string };

interface ItemSumario {
  numero: string;
  texto: string;
}

const RE_HEADING = /^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/;
const RE_BULLET = /^[-•*]\s+(.+)$/;
const RE_BULLET_LETRA = /^[a-z][.)]\s+(.+)$/i;

function analisarConteudo(conteudo: string): { blocos: Bloco[]; sumario: ItemSumario[] } {
  const linhas = conteudo.replace(/\r\n/g, '\n').split('\n');
  const blocos: Bloco[] = [];
  const sumario: ItemSumario[] = [];

  for (const bruto of linhas) {
    const linha = bruto.trim();
    if (linha === '') continue;

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
export async function gerarLaudoPdf(dados: DadosLaudoPdf): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
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

      function novaPagina(): number {
        doc.addPage();
        return doc.page.margins.top;
      }
      function garantir(y: number, altura: number): number {
        return y + altura > limiteInferior() ? novaPagina() : y;
      }

      // ---------- Corpo: primitivas de bloco ----------
      function desenharH1(y: number, numero: string, texto: string): number {
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
      }

      function desenharH2(y: number, numero: string, texto: string): number {
        const rotulo = `${numero}  ${texto}`;
        doc.font('Helvetica-Bold').fontSize(10.8);
        const altura = doc.heightOfString(rotulo, { width: largura });
        y = garantir(y, altura + 10) + 5;
        doc.fillColor(CORES.marcaEscura).text(rotulo, esquerda, y, { width: largura });
        return y + altura + 5;
      }

      function desenharParagrafo(y: number, texto: string): number {
        doc.font('Helvetica').fontSize(10.5).fillColor(CORES.tinta);
        const altura = doc.heightOfString(texto, { width: largura, align: 'justify' });
        y = garantir(y, altura);
        doc.text(texto, esquerda, y, { width: largura, align: 'justify' });
        return y + altura + 6;
      }

      function desenharBullet(y: number, texto: string): number {
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
      }

      function desenharCaixa(
        y: number,
        texto: string,
        cores: { fundo: string; barra: string; rotulo: string },
      ): number {
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
      }

      // ---------- Capa ----------
      function desenharCapa(): void {
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
      }

      // ---------- Sumario + normas ----------
      function desenharSumario(sumario: ItemSumario[]): void {
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
      }

      // ---------- Responsabilidade tecnica ----------
      function desenharResponsabilidade(yInicial: number): void {
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
      }

      // ---------- Cabecalho de controle (todas as paginas) ----------
      function desenharCabecalhoControle(folha: number, total: number): void {
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
      }

      function desenharRodapePagina(): void {
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
      }

      // ---------- Montagem ----------
      const { blocos, sumario } = analisarConteudo(dados.conteudo);

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
          default:
            y = desenharParagrafo(y, bloco.texto);
        }
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
