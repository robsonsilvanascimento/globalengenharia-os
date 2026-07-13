import ExcelJS from 'exceljs';
import type { PrismaClient } from '@prisma/client';

interface RelatorioOSParams {
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  tecnicoId?: string;
}

interface RelatorioFinanceiroParams {
  dataInicio?: string;
  dataFim?: string;
}

const STATUS_COLORS: Record<string, string> = {
  aberta: 'FFFFFF00',       // amarelo
  em_andamento: 'FFADD8E6', // azul claro
  concluida: 'FF90EE90',    // verde claro
  cancelada: 'FFFFCCCB',    // vermelho claro
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E79' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

function applyHeaderRow(row: ExcelJS.Row): void {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 20;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('pt-BR');
}

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export class ExcelExportService {
  constructor(private readonly prisma: PrismaClient) {}

  async gerarRelatorioOS(params: RelatorioOSParams): Promise<Buffer> {
    const dataInicio = params.dataInicio ? new Date(params.dataInicio) : undefined;
    const dataFim = params.dataFim ? new Date(params.dataFim) : undefined;

    const ordens = await this.prisma.ordemServico.findMany({
      where: {
        ...(dataInicio || dataFim
          ? {
              criadoEm: {
                ...(dataInicio ? { gte: dataInicio } : {}),
                ...(dataFim ? { lte: dataFim } : {}),
              },
            }
          : {}),
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.tecnicoId ? { tecnicoId: params.tecnicoId } : {}),
      },
      include: {
        cliente: { select: { nome: true } },
        tecnico: { select: { nome: true } },
        estimativaCusto: { select: { custoTotal: true, custoPecas: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Engenharia';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Ordens de Serviço');

    // Cabeçalho da empresa
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'GLOBAL ENGENHARIA — Relatório de Ordens de Serviço';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:I2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
    subtitleCell.font = { italic: true, size: 10 };
    subtitleCell.alignment = { horizontal: 'center' };

    // Linha em branco
    sheet.addRow([]);

    // Cabeçalho da tabela
    const headerRow = sheet.addRow([
      'Número OS',
      'Cliente',
      'Técnico',
      'Status',
      'Data Criação',
      'Data Conclusão',
      'Valor Estimado',
      'Custo Peças',
      'Total',
    ]);
    applyHeaderRow(headerRow);

    // Larguras
    sheet.getColumn(1).width = 16;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 16;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(7).width = 18;
    sheet.getColumn(8).width = 18;
    sheet.getColumn(9).width = 18;

    let somaEstimado = 0;
    let somaPecas = 0;
    let somaTotal = 0;

    for (const os of ordens) {
      const valorEstimado = os.estimativaCusto
        ? Number(os.estimativaCusto.custoTotal)
        : 0;
      const custoPecas = os.estimativaCusto
        ? Number(os.estimativaCusto.custoPecas)
        : Number(os.custoTotalPecas ?? 0);
      const total = valorEstimado + custoPecas;

      somaEstimado += valorEstimado;
      somaPecas += custoPecas;
      somaTotal += total;

      const dataRow = sheet.addRow([
        os.numero,
        os.cliente.nome,
        os.tecnico?.nome ?? '—',
        os.status,
        fmtDate(os.criadoEm),
        fmtDate(os.fechadoEm),
        fmtCurrency(valorEstimado),
        fmtCurrency(custoPecas),
        fmtCurrency(total),
      ]);

      const bgColor = STATUS_COLORS[os.status] ?? 'FFFFFFFF';
      dataRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'middle' };
      });
    }

    // Linha de totais
    const totalRow = sheet.addRow([
      'TOTAIS',
      '',
      '',
      '',
      '',
      '',
      fmtCurrency(somaEstimado),
      fmtCurrency(somaPecas),
      fmtCurrency(somaTotal),
    ]);
    totalRow.font = { bold: true, size: 11 };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    };
    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async gerarRelatorioFinanceiro(params: RelatorioFinanceiroParams): Promise<Buffer> {
    const dataInicio = params.dataInicio ? new Date(params.dataInicio) : undefined;
    const dataFim = params.dataFim ? new Date(params.dataFim) : undefined;

    const dateFilter = {
      ...(dataInicio ? { gte: dataInicio } : {}),
      ...(dataFim ? { lte: dataFim } : {}),
    };
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [pagamentos, comissoes] = await Promise.all([
      this.prisma.pagamentoOS.findMany({
        where: hasDateFilter ? { criadoEm: dateFilter } : {},
        include: {
          ordemServico: {
            select: { numero: true, cliente: { select: { nome: true } } },
          },
        },
        orderBy: { criadoEm: 'asc' },
      }),
      this.prisma.comissaoTecnico.findMany({
        where: hasDateFilter ? { criadoEm: dateFilter } : {},
        include: {
          tecnico: { select: { nome: true } },
          pagamentoOS: {
            select: {
              valor: true,
              ordemServico: { select: { numero: true } },
            },
          },
        },
        orderBy: { criadoEm: 'asc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Global Engenharia';
    workbook.created = new Date();

    // ── Aba Resumo ──────────────────────────────────────────────────────────
    const sheetResumo = workbook.addWorksheet('Resumo');

    sheetResumo.mergeCells('A1:E1');
    const resumoTitle = sheetResumo.getCell('A1');
    resumoTitle.value = 'GLOBAL ENGENHARIA — Resumo Financeiro Mensal';
    resumoTitle.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    resumoTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetResumo.getRow(1).height = 28;
    sheetResumo.addRow([]);

    const resumoHeader = sheetResumo.addRow([
      'Mês',
      'Receita Bruta',
      'Descontos',
      'Receita Líquida',
      'Comissões Pagas',
    ]);
    applyHeaderRow(resumoHeader);
    sheetResumo.getColumn(1).width = 14;
    sheetResumo.getColumn(2).width = 20;
    sheetResumo.getColumn(3).width = 16;
    sheetResumo.getColumn(4).width = 20;
    sheetResumo.getColumn(5).width = 20;

    // Agrupa pagamentos por mês
    const resumoMap = new Map<
      string,
      { receitaBruta: number; comissoes: number }
    >();

    for (const p of pagamentos) {
      if (p.statusPagamento !== 'pago') continue;
      const mes = p.pagoEm
        ? p.pagoEm.toISOString().slice(0, 7)
        : p.criadoEm.toISOString().slice(0, 7);
      const entry = resumoMap.get(mes) ?? { receitaBruta: 0, comissoes: 0 };
      entry.receitaBruta += Number(p.valor);
      resumoMap.set(mes, entry);
    }

    for (const c of comissoes) {
      const mes = c.criadoEm.toISOString().slice(0, 7);
      const entry = resumoMap.get(mes) ?? { receitaBruta: 0, comissoes: 0 };
      entry.comissoes += Number(c.valor);
      resumoMap.set(mes, entry);
    }

    const mesesOrdenados = Array.from(resumoMap.keys()).sort();
    for (const mes of mesesOrdenados) {
      const data = resumoMap.get(mes)!;
      const desconto = 0; // sem campo de desconto no schema
      const receitaLiquida = data.receitaBruta - desconto;
      const row = sheetResumo.addRow([
        mes,
        fmtCurrency(data.receitaBruta),
        fmtCurrency(desconto),
        fmtCurrency(receitaLiquida),
        fmtCurrency(data.comissoes),
      ]);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    // ── Aba Pagamentos ────────────────────────────────────────────────────────
    const sheetPag = workbook.addWorksheet('Pagamentos');

    sheetPag.mergeCells('A1:G1');
    const pagTitle = sheetPag.getCell('A1');
    pagTitle.value = 'GLOBAL ENGENHARIA — Pagamentos';
    pagTitle.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    pagTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetPag.getRow(1).height = 28;
    sheetPag.addRow([]);

    const pagHeader = sheetPag.addRow([
      'OS Número',
      'Cliente',
      'Valor',
      'Status',
      'Método',
      'Data Pagamento',
      'Data Criação',
    ]);
    applyHeaderRow(pagHeader);
    sheetPag.getColumn(1).width = 16;
    sheetPag.getColumn(2).width = 30;
    sheetPag.getColumn(3).width = 18;
    sheetPag.getColumn(4).width = 14;
    sheetPag.getColumn(5).width = 18;
    sheetPag.getColumn(6).width = 18;
    sheetPag.getColumn(7).width = 18;

    for (const p of pagamentos) {
      const row = sheetPag.addRow([
        p.ordemServico.numero,
        p.ordemServico.cliente.nome,
        fmtCurrency(Number(p.valor)),
        p.statusPagamento,
        p.tipo,
        fmtDate(p.pagoEm),
        fmtDate(p.criadoEm),
      ]);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'middle' };
      });
    }

    // ── Aba Comissões ─────────────────────────────────────────────────────────
    const sheetCom = workbook.addWorksheet('Comissões');

    sheetCom.mergeCells('A1:F1');
    const comTitle = sheetCom.getCell('A1');
    comTitle.value = 'GLOBAL ENGENHARIA — Comissões de Técnicos';
    comTitle.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    comTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheetCom.getRow(1).height = 28;
    sheetCom.addRow([]);

    const comHeader = sheetCom.addRow([
      'Técnico',
      'OS Número',
      'Valor Base (Pagamento)',
      'Percentual (%)',
      'Valor Comissão',
      'Data',
    ]);
    applyHeaderRow(comHeader);
    sheetCom.getColumn(1).width = 28;
    sheetCom.getColumn(2).width = 16;
    sheetCom.getColumn(3).width = 24;
    sheetCom.getColumn(4).width = 16;
    sheetCom.getColumn(5).width = 20;
    sheetCom.getColumn(6).width = 16;

    for (const c of comissoes) {
      const row = sheetCom.addRow([
        c.tecnico.nome,
        c.pagamentoOS.ordemServico.numero,
        fmtCurrency(Number(c.pagamentoOS.valor)),
        `${Number(c.percentual).toFixed(2)}%`,
        fmtCurrency(Number(c.valor)),
        fmtDate(c.criadoEm),
      ]);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'middle' };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
