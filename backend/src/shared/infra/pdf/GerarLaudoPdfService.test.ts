import { describe, expect, it } from 'vitest';
import { gerarLaudoPdf } from './GerarLaudoPdfService';

function esperaAssinaturaPdf(buffer: Buffer): void {
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
}

const base = {
  numero: 'LT-2026-0007',
  titulo: 'Laudo Técnico de Sistema de Aterramento',
  subtitulo: 'Edifício Aurora — Bloco A',
  tipoRotulo: 'SPDA / para-raios (NBR 5419)',
  clienteNome: 'Condomínio Edifício Aurora',
  normasAplicaveis: 'ABNT NBR 5419:2015 — Proteção contra descargas atmosféricas\nABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
  emitidoEm: new Date('2026-07-18T18:00:00Z'),
  conteudo: '1. Objetivo\n\nAvaliar o aterramento conforme a NBR 5419.\n\n2. Conclusão\n\nAdequar a resistência.',
  responsavelNome: 'Eng. Fulano',
  responsavelCrea: 'CREA-SP nº 000',
  artNumero: '123456',
};

describe('gerarLaudoPdf', () => {
  it('gera um PDF valido com conteudo e bloco de responsabilidade tecnica', async () => {
    esperaAssinaturaPdf(await gerarLaudoPdf(base));
  });

  it('gera PDF valido com secoes numeradas, subsecoes, listas e caixa de nao conformidade', async () => {
    const conteudo = [
      '1. DADOS DE IDENTIFICAÇÃO',
      'Contratante: Condomínio Aurora',
      '2. OBJETO',
      'Inspeção do SPDA existente. As medições visam assegurar que:',
      '- O sistema está conforme o projeto;',
      '- As conexões estão firmes e livres de corrosão.',
      '3. NÃO CONFORMIDADES',
      '3.1 Continuidade da malha',
      '[NC] Baixada rompida no ponto 2, sem continuidade elétrica com a malha.',
      '[!] Recomenda-se a substituição do conector de medição por conector de bronze.',
    ].join('\n');
    esperaAssinaturaPdf(await gerarLaudoPdf({ ...base, conteudo }));
  });

  it('gera PDF valido sem cliente e sem dados de ART (campos a preencher)', async () => {
    esperaAssinaturaPdf(
      await gerarLaudoPdf({
        numero: 'LT-2026-0008',
        titulo: 'Laudo',
        emitidoEm: new Date(),
        conteudo: 'Texto do laudo.',
      }),
    );
  });

  it('gera PDF valido com conteudo longo (exercita a quebra de pagina)', async () => {
    const conteudo = Array.from({ length: 60 }, (_, i) => `Paragrafo ${i + 1} do laudo tecnico com texto suficiente para ocupar a linha.`).join('\n\n');
    esperaAssinaturaPdf(await gerarLaudoPdf({ ...base, conteudo }));
  });
});
