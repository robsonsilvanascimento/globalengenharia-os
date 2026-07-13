import { describe, expect, it } from 'vitest';
import { calcularCustoTotalCliente, toNumber, type CustoTotalInput } from './calcularCustoTotal';

const BASE_FORM: CustoTotalInput = {
  horasEstimadasTecnico: '4',
  horasEstimadasAjudante: '',
  custoCombustivel: '30',
  custoPedagio: '10',
  custoDesgasteVeiculo: '5',
  custoAlmoco: '20',
  custoJanta: '0',
  custoEstadia: '0',
  turno: 'diurno',
  custoAdicionalNoturno: '50',
  outrosCustos: '0',
};

describe('toNumber', () => {
  it('parses plain numeric strings', () => {
    expect(toNumber('12.5')).toBe(12.5);
  });

  it('accepts comma as decimal separator', () => {
    expect(toNumber('12,5')).toBe(12.5);
  });

  it('defaults to 0 for empty or invalid input', () => {
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });
});

describe('calcularCustoTotalCliente', () => {
  it('sums technician hours, fixed costs, and extras when turno is diurno (ignoring night surcharge)', () => {
    const total = calcularCustoTotalCliente(BASE_FORM, 50, 30);
    // 4h * 50 + 30 + 10 + 5 + 20 + 0 + 0 + 0 (no night surcharge because turno = diurno)
    expect(total).toBe(4 * 50 + 30 + 10 + 5 + 20);
  });

  it('adds the night surcharge only when turno is noturno', () => {
    const form: CustoTotalInput = { ...BASE_FORM, turno: 'noturno' };
    const total = calcularCustoTotalCliente(form, 50, 30);
    expect(total).toBe(4 * 50 + 30 + 10 + 5 + 20 + 50);
  });

  it('includes helper (ajudante) hours in the total when informed', () => {
    const form: CustoTotalInput = { ...BASE_FORM, horasEstimadasAjudante: '2' };
    const total = calcularCustoTotalCliente(form, 50, 30);
    expect(total).toBe(4 * 50 + 2 * 30 + 30 + 10 + 5 + 20);
  });

  it('treats missing helper hours as zero contribution', () => {
    const semAjudante = calcularCustoTotalCliente(BASE_FORM, 50, 30);
    const comAjudanteZero = calcularCustoTotalCliente(
      { ...BASE_FORM, horasEstimadasAjudante: '0' },
      50,
      30,
    );
    expect(semAjudante).toBe(comAjudanteZero);
  });

  it('returns 0 when all inputs are empty/zero and valores-hora are 0', () => {
    const form: CustoTotalInput = {
      horasEstimadasTecnico: '',
      horasEstimadasAjudante: '',
      custoCombustivel: '',
      custoPedagio: '',
      custoDesgasteVeiculo: '',
      custoAlmoco: '',
      custoJanta: '',
      custoEstadia: '',
      turno: 'diurno',
      custoAdicionalNoturno: '',
      outrosCustos: '',
    };
    expect(calcularCustoTotalCliente(form, 0, 0)).toBe(0);
  });
});
