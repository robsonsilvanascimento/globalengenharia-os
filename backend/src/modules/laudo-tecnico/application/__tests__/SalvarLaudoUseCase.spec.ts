import { describe, expect, it, beforeEach } from 'vitest';
import { SalvarLaudoUseCase } from '../SalvarLaudoUseCase';
import type { Laudo } from '../../domain/Laudo';
import type { AtualizarLaudoDados, CriarLaudoDados, LaudoRepository } from '../../domain/LaudoRepository';

class FakeLaudoRepository implements LaudoRepository {
  public laudos: Laudo[] = [];
  private seq = 0;

  async criar(dados: CriarLaudoDados): Promise<Laudo> {
    const laudo: Laudo = {
      id: `laudo-${(this.seq += 1)}`,
      numero: dados.numero,
      ordemServicoId: dados.ordemServicoId ?? null,
      titulo: dados.titulo,
      tipo: dados.tipo,
      clienteNome: dados.clienteNome ?? null,
      conteudo: dados.conteudo,
      responsavelNome: dados.responsavelNome ?? null,
      responsavelCrea: dados.responsavelCrea ?? null,
      artNumero: dados.artNumero ?? null,
      emitidoEm: new Date(),
      criadoPorId: dados.criadoPorId ?? null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.laudos.push(laudo);
    return laudo;
  }
  async atualizar(id: string, dados: AtualizarLaudoDados): Promise<Laudo> {
    const laudo = this.laudos.find((l) => l.id === id)!;
    Object.assign(laudo, {
      titulo: dados.titulo ?? laudo.titulo,
      conteudo: dados.conteudo ?? laudo.conteudo,
      artNumero: dados.artNumero ?? laudo.artNumero,
    });
    return laudo;
  }
  async buscarPorId(id: string): Promise<Laudo | null> {
    return this.laudos.find((l) => l.id === id) ?? null;
  }
  async listarPorOrdemServico(osId: string): Promise<Laudo[]> {
    return this.laudos.filter((l) => l.ordemServicoId === osId);
  }
  async contarNoAno(): Promise<number> {
    return this.laudos.length;
  }
}

describe('SalvarLaudoUseCase', () => {
  let repo: FakeLaudoRepository;
  let useCase: SalvarLaudoUseCase;
  beforeEach(() => {
    repo = new FakeLaudoRepository();
    useCase = new SalvarLaudoUseCase({ laudoRepository: repo });
  });

  it('cria um laudo novo gerando numero no formato LT-ANO-NNNN', async () => {
    const laudo = await useCase.execute({
      titulo: 'Laudo de aterramento',
      tipo: 'spda',
      conteudo: 'Conteudo do laudo.',
      responsavelNome: 'Eng. Fulano',
      artNumero: '123',
    });
    expect(laudo.numero).toMatch(/^LT-\d{4}-0001$/);
    expect(laudo.artNumero).toBe('123');
  });

  it('gera numeros sequenciais para laudos do mesmo ano', async () => {
    const a = await useCase.execute({ titulo: 'A', tipo: 'spda', conteudo: 'x' });
    const b = await useCase.execute({ titulo: 'B', tipo: 'spda', conteudo: 'y' });
    expect(a.numero).toMatch(/-0001$/);
    expect(b.numero).toMatch(/-0002$/);
  });

  it('atualiza um laudo existente sem trocar o numero', async () => {
    const criado = await useCase.execute({ titulo: 'A', tipo: 'spda', conteudo: 'x' });
    const atualizado = await useCase.execute({
      id: criado.id,
      titulo: 'A revisado',
      tipo: 'spda',
      conteudo: 'x atualizado',
      artNumero: '999',
    });
    expect(atualizado.numero).toBe(criado.numero);
    expect(atualizado.artNumero).toBe('999');
    expect(repo.laudos).toHaveLength(1);
  });

  it('rejeita laudo sem titulo ou sem conteudo', async () => {
    await expect(useCase.execute({ titulo: '  ', tipo: 'spda', conteudo: 'x' })).rejects.toThrow();
    await expect(useCase.execute({ titulo: 'A', tipo: 'spda', conteudo: '   ' })).rejects.toThrow();
  });
});
