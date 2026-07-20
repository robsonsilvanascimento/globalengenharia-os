import { describe, expect, it } from 'vitest';
import { gerarRelatorioTecnico, type DadosRelatorioTecnico } from './GerarRelatorioTecnicoService';

function esperaAssinaturaPdf(buffer: Buffer): void {
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
}

const base: DadosRelatorioTecnico = {
  numero: 'OS-2026-000123',
  status: 'concluida',
  prioridade: 'alta',
  criadoEm: new Date('2026-07-01T10:00:00Z'),
  dataAgendada: new Date('2026-07-02T14:00:00Z'),
  fechadoEm: new Date('2026-07-03T17:30:00Z'),
  descricaoProblema: 'Desarme frequente do disjuntor geral do QGBT durante operação de máquinas de solda.',
  enderecoAtendimento: 'Rua das Indústrias, 450 — Distrito Industrial',
  criadoVia: 'whatsapp',
  valorCobrado: 850.5,
  clienteNome: 'Metalúrgica Sul Ltda',
  clienteTelefone: '5545999112233',
  clienteEmail: 'contato@metalurgicasul.com.br',
  clienteDocumento: '12.345.678/0001-90',
  categoriaNome: 'Manutenção corretiva em painel elétrico',
  categoriaArea: 'eletrica',
  tecnicoNome: 'Carlos Técnico',
  ajudanteNome: 'Bruno Ajudante',
  componentes: [],
  documentos: [],
  historico: [],
  geradoEm: new Date('2026-07-03T18:00:00Z'),
};

describe('gerarRelatorioTecnico', () => {
  it('gera um PDF valido com os dados minimos obrigatorios', async () => {
    esperaAssinaturaPdf(await gerarRelatorioTecnico(base));
  });

  it('gera PDF valido com componentes (incluindo garantia expirada), documentos e historico', async () => {
    const dados: DadosRelatorioTecnico = {
      ...base,
      componentes: [
        {
          nome: 'Disjuntor termomagnético 100A',
          fabricante: 'Schneider',
          modelo: 'EZC100',
          numeroSerie: 'SN-0099',
          garantiaMeses: 12,
          garantiaExpiraEm: new Date('2027-07-03T00:00:00Z'),
          observacoes: 'Substituído após rompimento de baixada.',
          documentos: [{ nome: 'Nota fiscal.pdf', tipoDocumento: 'nota_fiscal', tamanhoBytes: 123456 }],
        },
        {
          nome: 'Conector de bronze',
          garantiaMeses: 3,
          garantiaExpiraEm: new Date('2026-01-01T00:00:00Z'), // expirado
          documentos: [],
        },
      ],
      documentos: [{ nome: 'Foto antes.jpg', tipoDocumento: 'foto', tamanhoBytes: 2_500_000 }],
      historico: [
        { statusAnterior: null, statusNovo: 'aberta', alteradoPorBot: true, criadoEm: new Date('2026-07-01T10:00:00Z') },
        {
          statusAnterior: 'atribuida',
          statusNovo: 'em_andamento',
          alteradoPorBot: false,
          observacao: 'Técnico a caminho',
          criadoEm: new Date('2026-07-02T14:05:00Z'),
        },
      ],
    };
    esperaAssinaturaPdf(await gerarRelatorioTecnico(dados));
  });

  it('gera PDF valido com estimativa de custo completa e assinatura digital do cliente', async () => {
    const dados: DadosRelatorioTecnico = {
      ...base,
      estimativa: {
        horasEstimadasTecnico: 3,
        valorHoraTecnico: 80,
        horasEstimadasAjudante: 3,
        valorHoraAjudante: 40,
        custoCombustivel: 45,
        custoPedagio: 12,
        custoDesgasteVeiculo: 20,
        custoAlmoco: 25,
        custoJanta: 0,
        custoEstadia: 0,
        turno: 'diurno',
        custoAdicionalNoturno: 0,
        outrosCustos: 10,
        custoTotal: 472,
      },
      assinaturaBase64:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      assinaturaDataCriacao: new Date('2026-07-03T17:35:00Z'),
    };
    esperaAssinaturaPdf(await gerarRelatorioTecnico(dados));
  });

  it('gera PDF valido sem tecnico/ajudante atribuidos (secao de equipe omitida)', async () => {
    esperaAssinaturaPdf(
      await gerarRelatorioTecnico({ ...base, tecnicoNome: null, ajudanteNome: null }),
    );
  });
});
