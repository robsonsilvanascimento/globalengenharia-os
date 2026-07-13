import type { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { enviarEmailComAnexo } from '../../../shared/infra/email/EmailService';

const NOME_EMPRESA = 'Global Engenharia';
const COR_PRIMARIA = '#1e40af';
const COR_SECUNDARIA = '#f0f4ff';
const COR_TEXTO = '#1e293b';
const COR_TEXTO_LEVE = '#64748b';
const MARGEM = 50;
const LARGURA_PAGINA = 595.28;
const LARGURA_CONTEUDO = LARGURA_PAGINA - MARGEM * 2;

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularPeriodo(frequencia: string): { inicio: Date; fim: Date; label: string } {
  const agora = new Date();

  if (frequencia === 'semanal') {
    const diaSemana = agora.getDay(); // 0 = dom
    const diasAteSegundaAnterior = diaSemana === 0 ? 6 : diaSemana + 6;
    const segundaAnterior = new Date(agora);
    segundaAnterior.setDate(agora.getDate() - diasAteSegundaAnterior);
    segundaAnterior.setHours(0, 0, 0, 0);

    const domingoAnterior = new Date(segundaAnterior);
    domingoAnterior.setDate(segundaAnterior.getDate() + 6);
    domingoAnterior.setHours(23, 59, 59, 999);

    return {
      inicio: segundaAnterior,
      fim: domingoAnterior,
      label: `Semana de ${formatarData(segundaAnterior)} a ${formatarData(domingoAnterior)}`,
    };
  }

  const primeiroDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1, 0, 0, 0, 0);
  const ultimoDiaMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);

  return {
    inicio: primeiroDiaMesAnterior,
    fim: ultimoDiaMesAnterior,
    label: `${primeiroDiaMesAnterior.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
  };
}

async function gerarPdf(params: {
  periodo: string;
  osAbertas: number;
  osFechadas: number;
  receitaTotal: number;
  tecnicoMaisProdutivo: { nome: string; total: number } | null;
  pendencias: Array<{ numero: string }>;
}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGEM, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    // Cabeçalho
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COR_PRIMARIA)
      .text('RELATÓRIO GERENCIAL', MARGEM, MARGEM, { align: 'center', width: LARGURA_CONTEUDO });
    doc.fontSize(12).font('Helvetica').fillColor(COR_TEXTO_LEVE)
      .text(NOME_EMPRESA, MARGEM, doc.y + 4, { align: 'center', width: LARGURA_CONTEUDO });
    doc.fontSize(10).fillColor(COR_TEXTO_LEVE)
      .text(params.periodo, MARGEM, doc.y + 4, { align: 'center', width: LARGURA_CONTEUDO });

    doc.moveDown(1);
    doc.moveTo(MARGEM, doc.y).lineTo(LARGURA_PAGINA - MARGEM, doc.y).strokeColor(COR_PRIMARIA).lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    function secao(titulo: string) {
      doc.moveDown(0.8);
      const y = doc.y;
      doc.rect(MARGEM, y, LARGURA_CONTEUDO, 18).fill(COR_PRIMARIA);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff').text(titulo.toUpperCase(), MARGEM + 8, y + 4);
      doc.y = y + 26;
      doc.fillColor(COR_TEXTO);
    }

    function linha(rotulo: string, valor: string) {
      const y = doc.y;
      doc.rect(MARGEM, y, LARGURA_CONTEUDO, 22).fillAndStroke(COR_SECUNDARIA, '#c7d2fe');
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COR_TEXTO_LEVE)
        .text(rotulo, MARGEM + 8, y + 6, { continued: true, width: LARGURA_CONTEUDO * 0.6 });
      doc.font('Helvetica').fillColor(COR_TEXTO).text(valor, { align: 'right', width: LARGURA_CONTEUDO * 0.38 });
      doc.y = y + 26;
    }

    // Seção 1 - OS
    secao('1. Ordens de Serviço');
    linha('OS Abertas', String(params.osAbertas));
    linha('OS Fechadas (Concluídas)', String(params.osFechadas));

    // Seção 2 - Receita
    secao('2. Receita Total');
    linha('Receita no Período', formatarMoeda(params.receitaTotal));

    // Seção 3 - Técnico
    secao('3. Técnico Mais Produtivo');
    if (params.tecnicoMaisProdutivo) {
      linha('Nome', `${params.tecnicoMaisProdutivo.nome} (${params.tecnicoMaisProdutivo.total} OS concluídas)`);
    } else {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor(COR_TEXTO_LEVE)
        .text('Nenhuma OS concluída no período.', MARGEM + 8, doc.y);
    }

    // Seção 4 - Pendências
    secao('4. Pendências em Aberto');
    if (params.pendencias.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').fillColor(COR_TEXTO_LEVE)
        .text('Nenhuma pendência em aberto.', MARGEM + 8, doc.y);
    } else {
      for (const p of params.pendencias) {
        doc.fontSize(9).font('Helvetica').fillColor(COR_TEXTO)
          .text(`• OS #${p.numero}`, MARGEM + 8, doc.y);
      }
    }

    // Rodapé
    const totalPaginas = (doc as unknown as { bufferedPageRange: () => { count: number } }).bufferedPageRange().count;
    for (let i = 0; i < totalPaginas; i++) {
      doc.switchToPage(i);
      const yRodape = doc.page.height - MARGEM + 10;
      doc.moveTo(MARGEM, yRodape - 6).lineTo(LARGURA_PAGINA - MARGEM, yRodape - 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor(COR_TEXTO_LEVE)
        .text(NOME_EMPRESA, MARGEM, yRodape, { width: LARGURA_CONTEUDO / 2 });
      doc.text(`Página ${i + 1} de ${totalPaginas}`, MARGEM + LARGURA_CONTEUDO / 2, yRodape, { width: LARGURA_CONTEUDO / 2, align: 'right' });
    }

    doc.end();
  });
}

export interface GerarRelatorioGerencialDeps {
  prisma: PrismaClient;
}

export class GerarRelatorioGerencialUseCase {
  constructor(private readonly deps: GerarRelatorioGerencialDeps) {}

  async execute(configId: string): Promise<void> {
    const { prisma } = this.deps;

    const config = await prisma.configRelatorioGerencial.findUniqueOrThrow({ where: { id: configId } });
    const { frequencia, emailDestino } = config;

    const { inicio, fim, label } = calcularPeriodo(frequencia);

    const [osAbertas, osFechadas, receitaAgregada, pendencias] = await Promise.all([
      prisma.ordemServico.count({
        where: {
          criadoEm: { gte: inicio, lte: fim },
          status: { notIn: ['concluida', 'cancelada'] },
        },
      }),
      prisma.ordemServico.count({
        where: { status: 'concluida', fechadoEm: { gte: inicio, lte: fim } },
      }),
      prisma.ordemServico.aggregate({
        _sum: { valorCobrado: true },
        where: { status: 'concluida', fechadoEm: { gte: inicio, lte: fim } },
      }),
      prisma.ordemServico.findMany({
        where: { isPendente: true },
        select: { numero: true },
        orderBy: { numero: 'asc' },
      }),
    ]);

    const receitaTotal = Number(receitaAgregada._sum.valorCobrado ?? 0);

    // Técnico mais produtivo: OS concluídas no período agrupadas por técnico
    const osPorTecnico = await prisma.ordemServico.groupBy({
      by: ['tecnicoId'],
      where: {
        status: 'concluida',
        fechadoEm: { gte: inicio, lte: fim },
        tecnicoId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    let tecnicoMaisProdutivo: { nome: string; total: number } | null = null;
    if (osPorTecnico.length > 0 && osPorTecnico[0]!.tecnicoId) {
      const tecnico = await prisma.usuario.findUnique({
        where: { id: osPorTecnico[0]!.tecnicoId! },
        select: { nome: true },
      });
      if (tecnico) {
        tecnicoMaisProdutivo = { nome: tecnico.nome, total: osPorTecnico[0]!._count.id };
      }
    }

    const pdfBuffer = await gerarPdf({
      periodo: label,
      osAbertas,
      osFechadas,
      receitaTotal,
      tecnicoMaisProdutivo,
      pendencias: pendencias.map((p) => ({ numero: p.numero })),
    });

    await enviarEmailComAnexo(
      emailDestino,
      `Relatório Gerencial — ${label}`,
      `Segue em anexo o relatório gerencial referente ao período: ${label}.`,
      {
        filename: 'relatorio-gerencial.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    );
  }
}
