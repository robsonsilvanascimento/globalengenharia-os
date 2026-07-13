import { describe, it, expect } from 'vitest';
import { ListarRastreabilidadeOSUseCase } from '../ListarRastreabilidadeOSUseCase';
import type { ComponenteInstalado } from '../../domain/ComponenteInstalado';
import type { DocumentoOS } from '../../domain/DocumentoOS';
import type { ComponenteInstaladoRepository } from '../../domain/ComponenteInstaladoRepository';
import type { DocumentoOSRepository } from '../../domain/DocumentoOSRepository';

function fakeComponente(ordemServicoId: string, overrides?: Partial<ComponenteInstalado>): ComponenteInstalado {
  const now = new Date();
  return {
    id: 'comp-1',
    ordemServicoId,
    nome: 'Disjuntor 63A',
    fabricante: 'Siemens',
    modelo: '5SL6363-7',
    numeroSerie: 'SN-001',
    codigoBarras: null,
    garantiaMeses: 12,
    garantiaExpiraEm: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
    observacoes: null,
    criadoPorUsuarioId: null,
    criadoEm: now,
    atualizadoEm: now,
    ...overrides,
  };
}

function fakeDocumento(ordemServicoId: string, overrides?: Partial<DocumentoOS>): DocumentoOS {
  return {
    id: 'doc-1',
    ordemServicoId,
    componenteInstaladoId: null,
    nome: 'Certificado de Garantia',
    tipoDocumento: 'certificado_garantia',
    caminhoArmazenamento: 'documentos-os/os-1/cert.pdf',
    mimeType: 'application/pdf',
    tamanhoBytes: 50000,
    ativo: true,
    carregadoPorUsuarioId: null,
    criadoEm: new Date(),
    ...overrides,
  };
}

class FakeComponenteRepository implements ComponenteInstaladoRepository {
  constructor(private items: ComponenteInstalado[] = []) {}
  async create(input: never) { return input; }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async findByOrdemServico(osId: string) { return this.items.filter((c) => c.ordemServicoId === osId); }
  async findByNumeroSerie(ns: string) { return this.items.filter((c) => c.numeroSerie === ns); }
}

class FakeDocumentoRepository implements DocumentoOSRepository {
  constructor(private items: DocumentoOS[] = []) {}
  async create(input: never) { return input; }
  async findById(id: string) { return this.items.find((d) => d.id === id) ?? null; }
  async findByOrdemServico(osId: string) { return this.items.filter((d) => d.ordemServicoId === osId); }
  async findByComponente(cId: string) { return this.items.filter((d) => d.componenteInstaladoId === cId); }
  async deactivate(_id: string) {}
}

describe('ListarRastreabilidadeOSUseCase', () => {
  it('retorna componentes e documentos agrupados por componente', async () => {
    const osId = 'os-1';
    const componente = fakeComponente(osId, { id: 'comp-1' });
    const docVinculado = fakeDocumento(osId, { id: 'doc-1', componenteInstaladoId: 'comp-1' });
    const docSemComponente = fakeDocumento(osId, { id: 'doc-2', componenteInstaladoId: null });

    const useCase = new ListarRastreabilidadeOSUseCase({
      componenteInstaladoRepository: new FakeComponenteRepository([componente]),
      documentoOSRepository: new FakeDocumentoRepository([docVinculado, docSemComponente]),
    });

    const resultado = await useCase.execute(osId);

    expect(resultado.componentes).toHaveLength(1);
    expect(resultado.componentes[0]!.documentos).toHaveLength(1);
    expect(resultado.componentes[0]!.documentos[0]!.id).toBe('doc-1');
    expect(resultado.documentosSemComponente).toHaveLength(1);
    expect(resultado.documentosSemComponente[0]!.id).toBe('doc-2');
  });

  it('retorna listas vazias quando nao ha componentes nem documentos', async () => {
    const useCase = new ListarRastreabilidadeOSUseCase({
      componenteInstaladoRepository: new FakeComponenteRepository([]),
      documentoOSRepository: new FakeDocumentoRepository([]),
    });

    const resultado = await useCase.execute('os-vazia');
    expect(resultado.componentes).toHaveLength(0);
    expect(resultado.documentosSemComponente).toHaveLength(0);
  });
});
