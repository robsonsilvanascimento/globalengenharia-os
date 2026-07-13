import { describe, expect, it } from 'vitest';
import { gerarPdfOrdemServico } from './GerarPdfOrdemServicoService';
import type { DadosPdfOrdemServico } from './GerarPdfOrdemServicoService';

const dadosBase: DadosPdfOrdemServico = {
  numero: '2026-0001',
  criadoEm: new Date('2026-07-11T10:00:00Z'),
  clienteNome: 'Joao da Silva',
  clienteTelefone: '(11) 91234-5678',
  categoriaNome: 'Instalacao de Energia Solar',
  descricaoProblema: 'Painel solar nao esta gerando energia desde ontem.',
  prioridade: 'alta',
  status: 'aberta',
};

function esperaAssinaturaPdf(buffer: Buffer): void {
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
}

describe('gerarPdfOrdemServico', () => {
  it('gera um Buffer nao vazio com assinatura PDF valida (sem email, sem endereco)', async () => {
    const buffer = await gerarPdfOrdemServico(dadosBase);
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido com email e sem endereco', async () => {
    const buffer = await gerarPdfOrdemServico({
      ...dadosBase,
      clienteEmail: 'joao.silva@example.com',
    });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido sem email e com endereco', async () => {
    const buffer = await gerarPdfOrdemServico({
      ...dadosBase,
      enderecoAtendimento: 'Rua das Flores, 123 - Sao Paulo/SP',
    });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido com email e endereco', async () => {
    const buffer = await gerarPdfOrdemServico({
      ...dadosBase,
      clienteEmail: 'joao.silva@example.com',
      enderecoAtendimento: 'Rua das Flores, 123 - Sao Paulo/SP',
    });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido para diferentes status e prioridades', async () => {
    const buffer = await gerarPdfOrdemServico({
      ...dadosBase,
      status: 'concluida',
      prioridade: 'baixa',
    });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido mesmo quando o arquivo de logo nao existe (fallback para cabecalho em texto)', async () => {
    const buffer = await gerarPdfOrdemServico(dadosBase, {
      caminhoLogo: 'C:/caminho/inexistente/logo-que-nao-existe.png',
    });
    esperaAssinaturaPdf(buffer);
  });
});
