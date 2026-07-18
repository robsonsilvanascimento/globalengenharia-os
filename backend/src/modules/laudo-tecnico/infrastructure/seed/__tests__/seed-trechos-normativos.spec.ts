import { describe, expect, it, vi } from 'vitest';
import { seedTrechosNormativos } from '../seed-trechos-normativos';
import { CATEGORIAS_TRECHO, TRECHOS_NORMATIVOS_SEED } from '../trechos-normativos.seed';
import type { TrechoNormativoRepository } from '../../../domain/TrechoNormativoRepository';

function fakeRepo(ativosIniciais: number) {
  const criarVarios = vi.fn().mockResolvedValue(TRECHOS_NORMATIVOS_SEED.length);
  const repo = {
    contarAtivos: vi.fn().mockResolvedValue(ativosIniciais),
    criarVarios,
  } as unknown as TrechoNormativoRepository;
  return { repo, criarVarios };
}

describe('trechos-normativos seed', () => {
  it('todos os trechos da base tem norma, categoria valida, assunto e texto', () => {
    expect(TRECHOS_NORMATIVOS_SEED.length).toBeGreaterThan(0);
    for (const trecho of TRECHOS_NORMATIVOS_SEED) {
      expect(trecho.norma.trim()).not.toBe('');
      expect(trecho.assunto.trim()).not.toBe('');
      expect(trecho.texto.trim().length).toBeGreaterThan(20);
      expect(Object.keys(CATEGORIAS_TRECHO)).toContain(trecho.categoria);
    }
  });

  it('cobre as principais normas pedidas', () => {
    const normas = new Set(TRECHOS_NORMATIVOS_SEED.map((t) => t.norma));
    for (const esperada of ['NBR 5410', 'NBR 5419', 'NBR 16690', 'NBR 17019', 'IT CBPMESP', 'NR-10']) {
      expect(normas).toContain(esperada);
    }
  });

  it('popula a biblioteca quando esta vazia', async () => {
    const { repo, criarVarios } = fakeRepo(0);
    await seedTrechosNormativos(repo);
    expect(criarVarios).toHaveBeenCalledTimes(1);
    expect(criarVarios).toHaveBeenCalledWith(TRECHOS_NORMATIVOS_SEED);
  });

  it('nao repopula quando ja ha trechos cadastrados (idempotente)', async () => {
    const { repo, criarVarios } = fakeRepo(5);
    await seedTrechosNormativos(repo);
    expect(criarVarios).not.toHaveBeenCalled();
  });
});
