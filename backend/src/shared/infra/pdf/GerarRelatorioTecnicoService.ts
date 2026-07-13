import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface ComponenteRelatorio {
  nome: string;
  fabricante?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  garantiaMeses?: number | null;
  garantiaExpiraEm?: Date | null;
  observacoes?: string | null;
  documentos: Array<{ nome: string; tipoDocumento: string; tamanhoBytes: number }>;
}

export interface HistoricoRelatorio {
  statusAnterior?: string | null;
  statusNovo: string;
  alteradoPorBot: boolean;
  observacao?: string | null;
  criadoEm: Date;
}

export interface EstimativaRelatorio {
  horasEstimadasTecnico: number;
  valorHoraTecnico: number;
  horasEstimadasAjudante?: number | null;
  valorHoraAjudante?: number | null;
  custoCombustivel: number;
  custoPedagio: number;
  custoDesgasteVeiculo: number;
  custoAlmoco: number;
  custoJanta: number;
  custoEstadia: number;
  turno: string;
  custoAdicionalNoturno: number;
  outrosCustos: number;
  custoTotal: number;
}

export interface DadosRelatorioTecnico {
  // OS
  numero: string;
  status: string;
  prioridade: string;
  criadoEm: Date;
  dataAgendada?: Date | null;
  fechadoEm?: Date | null;
  descricaoProblema: string;
  enderecoAtendimento?: string | null;
  criadoVia: string;
  valorCobrado?: number | null;
  // Cliente
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail?: string | null;
  clienteDocumento?: string | null;
  // Serviço
  categoriaNome: string;
  categoriaArea: string;
  // Equipe
  tecnicoNome?: string | null;
  ajudanteNome?: string | null;
  // Rastreabilidade
  componentes: ComponenteRelatorio[];
  documentos: Array<{ nome: string; tipoDocumento: string; tamanhoBytes: number }>;
  // Histórico
  historico: HistoricoRelatorio[];
  // Custo
  estimativa?: EstimativaRelatorio | null;
  // Assinatura digital
  assinaturaBase64?: string | null;
  assinaturaDataCriacao?: Date | null;
  // Geração
  geradoPorNome?: string | null;
  geradoEm: Date;
}

const NOME_EMPRESA = 'Global Engenharia';
const COR_PRIMARIA = '#1e40af'; // azul escuro
const COR_SECUNDARIA = '#f0f4ff';
const COR_TEXTO = '#1e293b';
const COR_TEXTO_LEVE = '#64748b';
const LARGURA_LOGO = 140;
const MARGEM = 50;
const LARGURA_PAGINA = 595.28; // A4
const LARGURA_CONTEUDO = LARGURA_PAGINA - MARGEM * 2;

const TIPO_LABELS: Record<string, string> = {
  certificado_garantia: 'Certificado de Garantia',
  manual: 'Manual Técnico',
  laudo_tecnico: 'Laudo Técnico',
  nota_fiscal: 'Nota Fiscal',
  foto: 'Foto',
  outro: 'Outro',
};

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  triagem: 'Em Triagem',
  atribuida: 'Atribuída',
  em_andamento: 'Em Andamento',
  aguardando_peca: 'Aguardando Peça',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const PRIORIDADE_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

const AREA_LABELS: Record<string, string> = {
  eletrica: 'Elétrica',
  automacao: 'Automação',
  energia_solar: 'Energia Solar',
  outro: 'Outros',
};

function resolverCaminhoPadraoDoLogo(): string {
  return path.join(__dirname, '..', '..', '..', '..', 'assets', 'brand', 'logo.png');
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export async function gerarRelatorioTecnico(dados: DadosRelatorioTecnico): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: MARGEM, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      // -----------------------------------------------------------------------
      // CABEÇALHO
      // -----------------------------------------------------------------------
      const caminhoLogo = resolverCaminhoPadraoDoLogo();
      let yAposLogo = doc.y;
      try {
        const abrirImagem = (doc as unknown as { openImage: (s: string) => { width: number; height: number } }).openImage.bind(doc);
        const img = abrirImagem(caminhoLogo);
        const alturaLogo = (LARGURA_LOGO / img.width) * img.height;
        doc.image(caminhoLogo, MARGEM, MARGEM, { width: LARGURA_LOGO });
        yAposLogo = MARGEM + alturaLogo + 6;
      } catch {
        doc.fontSize(16).font('Helvetica-Bold').fillColor(COR_PRIMARIA).text(NOME_EMPRESA, MARGEM, MARGEM);
        yAposLogo = doc.y + 4;
      }

      // Título do relatório (lado direito)
      doc
        .fontSize(18).font('Helvetica-Bold').fillColor(COR_PRIMARIA)
        .text('RELATÓRIO TÉCNICO', MARGEM, MARGEM + 4, { align: 'right', width: LARGURA_CONTEUDO });
      doc
        .fontSize(10).font('Helvetica').fillColor(COR_TEXTO_LEVE)
        .text(`OS #${dados.numero}`, MARGEM, MARGEM + 28, { align: 'right', width: LARGURA_CONTEUDO });

      doc.y = yAposLogo;

      // Linha separadora
      doc.moveTo(MARGEM, doc.y).lineTo(LARGURA_PAGINA - MARGEM, doc.y).strokeColor(COR_PRIMARIA).lineWidth(1.5).stroke();
      doc.moveDown(0.5);

      // -----------------------------------------------------------------------
      // IDENTIFICAÇÃO DA OS — destaque
      // -----------------------------------------------------------------------
      const yBloco = doc.y;
      doc.rect(MARGEM, yBloco, LARGURA_CONTEUDO, 52).fillAndStroke(COR_SECUNDARIA, '#c7d2fe');
      doc
        .fontSize(12).font('Helvetica-Bold').fillColor(COR_PRIMARIA)
        .text(`OS Nº ${dados.numero}`, MARGEM + 12, yBloco + 10);

      const statusLabel = STATUS_LABELS[dados.status] ?? dados.status;
      const prioLabel = PRIORIDADE_LABELS[dados.prioridade] ?? dados.prioridade;

      doc.fontSize(9).font('Helvetica').fillColor(COR_TEXTO);
      doc.text(`Status: ${statusLabel}   |   Prioridade: ${prioLabel}   |   Canal: ${dados.criadoVia === 'whatsapp' ? 'WhatsApp' : 'Painel'}`, MARGEM + 12, yBloco + 28);
      doc.text(`Aberta em: ${formatarDataHora(dados.criadoEm)}${dados.dataAgendada ? `   |   Agendada: ${formatarDataHora(dados.dataAgendada)}` : ''}${dados.fechadoEm ? `   |   Fechada: ${formatarDataHora(dados.fechadoEm)}` : ''}`, MARGEM + 12, yBloco + 40);

      doc.y = yBloco + 62;

      // -----------------------------------------------------------------------
      // HELPER: seção com título
      // -----------------------------------------------------------------------
      function secao(titulo: string) {
        doc.moveDown(0.6);
        const y = doc.y;
        doc.rect(MARGEM, y, LARGURA_CONTEUDO, 18).fill(COR_PRIMARIA);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text(titulo.toUpperCase(), MARGEM + 8, y + 4);
        doc.y = y + 22;
        doc.fillColor(COR_TEXTO);
      }

      function campo(rotulo: string, valor: string | null | undefined, x = MARGEM + 4, largura = LARGURA_CONTEUDO - 8) {
        if (!valor) return;
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COR_TEXTO_LEVE).text(`${rotulo}: `, x, doc.y, { continued: true, width: largura });
        doc.font('Helvetica').fillColor(COR_TEXTO).text(valor);
      }

      function pularSeNecessario(alturaMinima: number) {
        if (doc.y + alturaMinima > doc.page.height - MARGEM - 30) {
          doc.addPage();
        }
      }

      // -----------------------------------------------------------------------
      // DADOS DO CLIENTE
      // -----------------------------------------------------------------------
      secao('Dados do Cliente');
      campo('Nome', dados.clienteNome);
      campo('Telefone/WhatsApp', dados.clienteTelefone);
      if (dados.clienteEmail) campo('E-mail', dados.clienteEmail);
      if (dados.clienteDocumento) campo('CPF/CNPJ', dados.clienteDocumento);

      // -----------------------------------------------------------------------
      // SERVIÇO SOLICITADO
      // -----------------------------------------------------------------------
      secao('Serviço Solicitado');
      campo('Categoria', `${dados.categoriaNome} (${AREA_LABELS[dados.categoriaArea] ?? dados.categoriaArea})`);
      if (dados.enderecoAtendimento) campo('Endereço de Atendimento', dados.enderecoAtendimento);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COR_TEXTO_LEVE).text('Descrição do Problema: ', MARGEM + 4, doc.y, { continued: true });
      doc.font('Helvetica').fillColor(COR_TEXTO).text(dados.descricaoProblema);

      // -----------------------------------------------------------------------
      // EQUIPE TÉCNICA
      // -----------------------------------------------------------------------
      if (dados.tecnicoNome || dados.ajudanteNome) {
        secao('Equipe Técnica Responsável');
        if (dados.tecnicoNome) campo('Técnico Responsável', dados.tecnicoNome);
        if (dados.ajudanteNome) campo('Auxiliar/Ajudante', dados.ajudanteNome);
      }

      // -----------------------------------------------------------------------
      // COMPONENTES INSTALADOS
      // -----------------------------------------------------------------------
      if (dados.componentes.length > 0) {
        secao(`Componentes Instalados (${dados.componentes.length})`);

        for (const comp of dados.componentes) {
          pularSeNecessario(60);
          const yComp = doc.y;
          doc.rect(MARGEM, yComp, LARGURA_CONTEUDO, 1).fill('#e2e8f0');
          doc.y = yComp + 5;

          doc.fontSize(9).font('Helvetica-Bold').fillColor(COR_TEXTO).text(comp.nome, MARGEM + 4, doc.y);
          const detalhes: string[] = [];
          if (comp.fabricante) detalhes.push(`Fabricante: ${comp.fabricante}`);
          if (comp.modelo) detalhes.push(`Modelo: ${comp.modelo}`);
          if (comp.numeroSerie) detalhes.push(`Nº Série: ${comp.numeroSerie}`);
          if (detalhes.length > 0) {
            doc.fontSize(8).font('Helvetica').fillColor(COR_TEXTO_LEVE).text(detalhes.join('   ·   '), MARGEM + 4, doc.y);
          }
          if (comp.garantiaMeses != null) {
            const expirou = comp.garantiaExpiraEm && comp.garantiaExpiraEm < new Date();
            const garantiaTxt = expirou
              ? `Garantia EXPIRADA em ${comp.garantiaExpiraEm ? formatarData(comp.garantiaExpiraEm) : '?'}`
              : `Garantia: ${comp.garantiaMeses} meses${comp.garantiaExpiraEm ? ` (até ${formatarData(comp.garantiaExpiraEm)})` : ''}`;
            doc.fontSize(8).font('Helvetica-Oblique').fillColor(expirou ? '#dc2626' : '#16a34a').text(garantiaTxt, MARGEM + 4, doc.y);
          }
          if (comp.observacoes) {
            doc.fontSize(8).font('Helvetica-Oblique').fillColor(COR_TEXTO_LEVE).text(`Obs: ${comp.observacoes}`, MARGEM + 4, doc.y);
          }
          if (comp.documentos.length > 0) {
            doc.fontSize(8).font('Helvetica').fillColor(COR_TEXTO_LEVE).text(
              `Documentos: ${comp.documentos.map((d) => `${d.nome} (${TIPO_LABELS[d.tipoDocumento] ?? d.tipoDocumento})`).join(', ')}`,
              MARGEM + 4, doc.y,
            );
          }
          doc.moveDown(0.3);
        }
      }

      // -----------------------------------------------------------------------
      // DOCUMENTOS DA OS
      // -----------------------------------------------------------------------
      const todosDocumentos = dados.documentos;
      if (todosDocumentos.length > 0) {
        secao(`Documentos Anexados (${todosDocumentos.length})`);
        for (const doc2 of todosDocumentos) {
          pularSeNecessario(20);
          doc.fontSize(9).font('Helvetica').fillColor(COR_TEXTO)
            .text(`• ${doc2.nome}  —  ${TIPO_LABELS[doc2.tipoDocumento] ?? doc2.tipoDocumento}  (${formatarBytes(doc2.tamanhoBytes)})`, MARGEM + 8, doc.y);
        }
      }

      // -----------------------------------------------------------------------
      // ESTIMATIVA DE CUSTO
      // -----------------------------------------------------------------------
      if (dados.estimativa) {
        const est = dados.estimativa;
        secao('Estimativa de Custos');

        const itens: [string, number][] = [
          [`Mão de obra técnico (${est.horasEstimadasTecnico}h × ${formatarMoeda(est.valorHoraTecnico)}/h)`, est.horasEstimadasTecnico * est.valorHoraTecnico],
        ];
        if (est.horasEstimadasAjudante && est.valorHoraAjudante) {
          itens.push([`Mão de obra auxiliar (${est.horasEstimadasAjudante}h × ${formatarMoeda(est.valorHoraAjudante)}/h)`, est.horasEstimadasAjudante * est.valorHoraAjudante]);
        }
        if (est.custoCombustivel > 0) itens.push(['Combustível', est.custoCombustivel]);
        if (est.custoPedagio > 0) itens.push(['Pedágio', est.custoPedagio]);
        if (est.custoDesgasteVeiculo > 0) itens.push(['Desgaste de veículo', est.custoDesgasteVeiculo]);
        if (est.custoAlmoco > 0) itens.push(['Almoço', est.custoAlmoco]);
        if (est.custoJanta > 0) itens.push(['Janta', est.custoJanta]);
        if (est.custoEstadia > 0) itens.push(['Estadia', est.custoEstadia]);
        if (est.custoAdicionalNoturno > 0) itens.push([`Adicional noturno (turno: ${est.turno})`, est.custoAdicionalNoturno]);
        if (est.outrosCustos > 0) itens.push(['Outros custos', est.outrosCustos]);

        for (const [desc, val] of itens) {
          const y = doc.y;
          doc.fontSize(9).font('Helvetica').fillColor(COR_TEXTO).text(desc, MARGEM + 4, y, { width: LARGURA_CONTEUDO * 0.7 });
          doc.text(formatarMoeda(val), MARGEM + 4 + LARGURA_CONTEUDO * 0.7, y, { width: LARGURA_CONTEUDO * 0.3 - 4, align: 'right' });
          doc.y = y + 14;
        }

        pularSeNecessario(24);
        doc.moveTo(MARGEM, doc.y).lineTo(LARGURA_PAGINA - MARGEM, doc.y).strokeColor('#94a3b8').lineWidth(0.5).stroke();
        doc.y += 4;
        const yTotal = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COR_PRIMARIA).text('TOTAL ESTIMADO', MARGEM + 4, yTotal, { width: LARGURA_CONTEUDO * 0.7 });
        doc.text(formatarMoeda(est.custoTotal), MARGEM + 4 + LARGURA_CONTEUDO * 0.7, yTotal, { width: LARGURA_CONTEUDO * 0.3 - 4, align: 'right' });
        doc.y = yTotal + 16;

        if (dados.valorCobrado != null) {
          const yVc = doc.y;
          doc.fontSize(9).font('Helvetica').fillColor(COR_TEXTO).text('Valor cobrado do cliente', MARGEM + 4, yVc, { width: LARGURA_CONTEUDO * 0.7 });
          doc.font('Helvetica-Bold').text(formatarMoeda(dados.valorCobrado), MARGEM + 4 + LARGURA_CONTEUDO * 0.7, yVc, { width: LARGURA_CONTEUDO * 0.3 - 4, align: 'right' });
          doc.y = yVc + 14;
        }
      }

      // -----------------------------------------------------------------------
      // HISTÓRICO DE STATUS
      // -----------------------------------------------------------------------
      if (dados.historico.length > 0) {
        secao('Histórico de Status');
        for (const h of dados.historico) {
          pularSeNecessario(16);
          const ante = h.statusAnterior ? (STATUS_LABELS[h.statusAnterior] ?? h.statusAnterior) : 'Abertura';
          const novo = STATUS_LABELS[h.statusNovo] ?? h.statusNovo;
          const agente = h.alteradoPorBot ? '(bot)' : '(painel)';
          doc.fontSize(8).font('Helvetica').fillColor(COR_TEXTO)
            .text(`${formatarDataHora(h.criadoEm)}  ·  ${ante} → ${novo}  ${agente}${h.observacao ? `  —  ${h.observacao}` : ''}`, MARGEM + 8, doc.y);
        }
      }

      // -----------------------------------------------------------------------
      // ASSINATURAS
      // -----------------------------------------------------------------------
      pularSeNecessario(120);
      secao('Assinaturas e Declarações');

      doc.fontSize(8).font('Helvetica-Oblique').fillColor(COR_TEXTO_LEVE)
        .text('Declaro que os serviços descritos neste relatório foram executados conforme as normas técnicas aplicáveis (ABNT NBR 5410, NR-10 e demais regulamentações vigentes).', MARGEM + 4, doc.y, { width: LARGURA_CONTEUDO });
      doc.moveDown(1.5);

      const yAssin = doc.y;
      const larguraCampo = (LARGURA_CONTEUDO - 20) / 3;

      const assinaturas = [
        { label: 'Técnico Responsável', nome: dados.tecnicoNome },
        { label: 'Cliente / Responsável', nome: dados.clienteNome },
        { label: 'Supervisor / Conferente', nome: null },
      ];

      for (let i = 0; i < assinaturas.length; i++) {
        const xAssin = MARGEM + i * (larguraCampo + 10);
        // Linha de assinatura
        doc.moveTo(xAssin, yAssin + 40).lineTo(xAssin + larguraCampo, yAssin + 40).strokeColor('#94a3b8').lineWidth(0.5).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor(COR_TEXTO).text(assinaturas[i]!.label, xAssin, yAssin + 43, { width: larguraCampo, align: 'center' });
        if (assinaturas[i]!.nome) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor(COR_TEXTO_LEVE).text(assinaturas[i]!.nome!, xAssin, yAssin + 54, { width: larguraCampo, align: 'center' });
        }
        // Linha de data
        doc.fontSize(7.5).font('Helvetica').fillColor(COR_TEXTO).text('Data: ____/____/________', xAssin, yAssin + 64, { width: larguraCampo, align: 'center' });
      }

      doc.y = yAssin + 80;

      // -----------------------------------------------------------------------
      // ASSINATURA DIGITAL DO CLIENTE
      // -----------------------------------------------------------------------
      if (dados.assinaturaBase64) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').fillColor(COR_PRIMARIA)
          .text('Assinatura Digital do Cliente', MARGEM, MARGEM + 20, { align: 'center', width: LARGURA_CONTEUDO });
        doc.moveDown(1.5);

        const imgBuffer = Buffer.from(
          dados.assinaturaBase64.replace(/^data:image\/\w+;base64,/, ''),
          'base64',
        );
        const xImg = MARGEM + (LARGURA_CONTEUDO - 400) / 2;
        doc.image(imgBuffer, xImg, doc.y, { fit: [400, 200], align: 'center' });
        doc.y += 210;

        if (dados.assinaturaDataCriacao) {
          doc.fontSize(10).font('Helvetica').fillColor(COR_TEXTO_LEVE)
            .text(`Assinado em: ${dados.assinaturaDataCriacao.toLocaleDateString('pt-BR')}`, MARGEM, doc.y, { align: 'center', width: LARGURA_CONTEUDO });
        }
      }

      // -----------------------------------------------------------------------
      // RODAPÉ COM NUMERAÇÃO
      // -----------------------------------------------------------------------
      const totalPaginas = (doc as unknown as { bufferedPageRange: () => { count: number } }).bufferedPageRange().count;
      for (let i = 0; i < totalPaginas; i++) {
        doc.switchToPage(i);
        const yRodape = doc.page.height - MARGEM + 10;
        doc.moveTo(MARGEM, yRodape - 6).lineTo(LARGURA_PAGINA - MARGEM, yRodape - 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
        doc.fontSize(7).font('Helvetica').fillColor(COR_TEXTO_LEVE)
          .text(NOME_EMPRESA, MARGEM, yRodape, { width: LARGURA_CONTEUDO / 3 });
        doc.text(`Relatório Técnico OS #${dados.numero} — Gerado em ${formatarDataHora(dados.geradoEm)}`, MARGEM + LARGURA_CONTEUDO / 3, yRodape, { width: LARGURA_CONTEUDO / 3, align: 'center' });
        doc.text(`Página ${i + 1} de ${totalPaginas}`, MARGEM + (LARGURA_CONTEUDO * 2) / 3, yRodape, { width: LARGURA_CONTEUDO / 3, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
