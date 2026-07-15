import { describe, expect, it } from 'vitest';
import { detectarIntencaoPagamento } from './DetectarIntencaoPagamento';

describe('detectarIntencaoPagamento', () => {
  it('retorna null para uma mensagem de abertura de OS comum', () => {
    expect(detectarIntencaoPagamento('Oi')).toBeNull();
    expect(detectarIntencaoPagamento('Joao Pereira')).toBeNull();
    expect(detectarIntencaoPagamento('Meu chuveiro parou de funcionar')).toBeNull();
  });

  it('retorna null para mensagem vazia/so espacos', () => {
    expect(detectarIntencaoPagamento('')).toBeNull();
    expect(detectarIntencaoPagamento('   ')).toBeNull();
  });

  it.each(['ja paguei', 'quero pagar', 'cade meu pix?', 'nao recebi o boleto', 'quanto eu devo', 'minha fatura'])(
    'detecta intencao de pagamento por palavra-chave em "%s"',
    (mensagem) => {
      expect(detectarIntencaoPagamento(mensagem)).toEqual({});
    },
  );

  it('detecta acentos normalizados (cobranca/divida)', () => {
    expect(detectarIntencaoPagamento('quero saber da cobrança')).toEqual({});
    expect(detectarIntencaoPagamento('qual minha dívida?')).toEqual({});
  });

  it('detecta e normaliza o numero da OS junto com a intencao de pagamento', () => {
    expect(detectarIntencaoPagamento('ja paguei a OS-2026-000123')).toEqual({ numeroOS: 'OS-2026-000123' });
    expect(detectarIntencaoPagamento('quero pagar a os 2026 123')).toEqual({ numeroOS: 'OS-2026-000123' });
  });
});
