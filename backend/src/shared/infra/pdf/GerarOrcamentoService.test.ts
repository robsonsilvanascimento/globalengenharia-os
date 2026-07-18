import { describe, expect, it } from 'vitest';
import { gerarOrcamentoPdf } from './GerarOrcamentoService';

function esperaAssinaturaPdf(buffer: Buffer): void {
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
}

const base = {
  numeroOS: 'OS-2026-000042',
  clienteNome: 'João Pereira Santos',
  emitidoEm: new Date('2026-07-18T17:30:00Z'),
  itens: [
    { descricao: 'Mão de obra (3h)', valor: 450 },
    { descricao: 'Materiais', valor: 620.9 },
  ],
  valorTotal: 1070.9,
};

describe('gerarOrcamentoPdf', () => {
  it('gera um PDF valido com itens, total e observacao', async () => {
    const buffer = await gerarOrcamentoPdf({ ...base, observacao: 'Inclui ART e garantia de 12 meses.' });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido sem observacao', async () => {
    const buffer = await gerarOrcamentoPdf(base);
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido com muitos itens (exercita a paginacao da tabela)', async () => {
    const itens = Array.from({ length: 40 }, (_, i) => ({ descricao: `Item ${i + 1}`, valor: i + 1 }));
    const valorTotal = itens.reduce((s, i) => s + i.valor, 0);
    const buffer = await gerarOrcamentoPdf({ ...base, itens, valorTotal });
    esperaAssinaturaPdf(buffer);
  });
});
