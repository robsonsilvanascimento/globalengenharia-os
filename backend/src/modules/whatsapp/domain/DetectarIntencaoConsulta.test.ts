import { describe, expect, it } from 'vitest';
import { detectarIntencaoConsulta } from './DetectarIntencaoConsulta';

describe('detectarIntencaoConsulta', () => {
  it('retorna null para uma mensagem de abertura de OS comum', () => {
    expect(detectarIntencaoConsulta('Oi')).toBeNull();
    expect(detectarIntencaoConsulta('Joao Pereira')).toBeNull();
    expect(detectarIntencaoConsulta('Meu chuveiro parou de funcionar')).toBeNull();
  });

  it('retorna null para mensagem vazia/so espacos', () => {
    expect(detectarIntencaoConsulta('')).toBeNull();
    expect(detectarIntencaoConsulta('   ')).toBeNull();
  });

  it.each(['status', 'Status da minha OS', 'qual o andamento?', 'quero consultar', 'gostaria de acompanhar'])(
    'detecta intencao de consulta por palavra-chave em "%s"',
    (mensagem) => {
      expect(detectarIntencaoConsulta(mensagem)).toEqual({});
    },
  );

  it('detecta e normaliza o numero completo da OS (OS-AAAA-NNNNNN)', () => {
    expect(detectarIntencaoConsulta('OS-2026-000123')).toEqual({ numeroOS: 'OS-2026-000123' });
  });

  it('detecta e normaliza variacoes de formatacao do numero completo', () => {
    expect(detectarIntencaoConsulta('os 2026 123')).toEqual({ numeroOS: 'OS-2026-000123' });
    expect(detectarIntencaoConsulta('Quero saber da OS2026123')).toEqual({ numeroOS: 'OS-2026-000123' });
  });

  it('detecta apenas o numero/sequencial quando o cliente informa so os digitos', () => {
    expect(detectarIntencaoConsulta('123')).toEqual({ numeroOS: '123' });
    expect(detectarIntencaoConsulta('000123')).toEqual({ numeroOS: '000123' });
  });
});
