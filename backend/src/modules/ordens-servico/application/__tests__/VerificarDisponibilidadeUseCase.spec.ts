import { describe, expect, it, vi } from 'vitest';
import type { Usuario } from '../../../auth/domain/Usuario';
import type { UsuarioRepository } from '../../../auth/domain/UsuarioRepository';
import { VerificarDisponibilidadeUseCase } from '../VerificarDisponibilidadeUseCase';
import { criarOrdemServicoFake, FakeOrdemServicoRepository } from './fakes';

function criarUsuarioFake(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'usuario-1',
    nome: 'Fulano',
    email: 'fulano@example.com',
    senhaHash: 'hash-fake',
    papel: 'tecnico',
    ativo: true,
    criadoEm: new Date(),
    ...overrides,
  };
}

function criarUsuarioRepositoryFake(usuarios: Usuario[]): UsuarioRepository {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    list: vi.fn().mockResolvedValue(usuarios),
    update: vi.fn(),
  };
}

function criarUseCase() {
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const useCase = new VerificarDisponibilidadeUseCase({ ordemServicoRepository });
  return { useCase, ordemServicoRepository };
}

const DATA_HORA = new Date('2026-08-10T14:00:00.000Z');

describe('VerificarDisponibilidadeUseCase', () => {
  describe('verificarUsuarioDisponivel', () => {
    it('retorna true quando o usuario nao tem nenhuma OS conflitante', async () => {
      const { useCase } = criarUseCase();

      const disponivel = await useCase.verificarUsuarioDisponivel('usuario-1', DATA_HORA);

      expect(disponivel).toBe(true);
    });

    it('retorna false quando o usuario ja e tecnico de uma OS na mesma data/hora', async () => {
      const { useCase, ordemServicoRepository } = criarUseCase();
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', tecnicoId: 'usuario-1', dataAgendada: DATA_HORA }),
      );

      const disponivel = await useCase.verificarUsuarioDisponivel('usuario-1', DATA_HORA);

      expect(disponivel).toBe(false);
    });

    it('retorna false quando o usuario ja e ajudante de uma OS na mesma data/hora', async () => {
      const { useCase, ordemServicoRepository } = criarUseCase();
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', ajudanteId: 'usuario-1', dataAgendada: DATA_HORA }),
      );

      const disponivel = await useCase.verificarUsuarioDisponivel('usuario-1', DATA_HORA);

      expect(disponivel).toBe(false);
    });

    it('OS cancelada nao conta como conflito', async () => {
      const { useCase, ordemServicoRepository } = criarUseCase();
      ordemServicoRepository.seed(
        criarOrdemServicoFake({
          id: 'os-1',
          tecnicoId: 'usuario-1',
          dataAgendada: DATA_HORA,
          status: 'cancelada',
        }),
      );

      const disponivel = await useCase.verificarUsuarioDisponivel('usuario-1', DATA_HORA);

      expect(disponivel).toBe(true);
    });

    it('ordemServicoIdParaIgnorar ignora a propria OS ao reeditar', async () => {
      const { useCase, ordemServicoRepository } = criarUseCase();
      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', tecnicoId: 'usuario-1', dataAgendada: DATA_HORA }),
      );

      const disponivelIgnorandoPropriaOS = await useCase.verificarUsuarioDisponivel(
        'usuario-1',
        DATA_HORA,
        'os-1',
      );
      const disponivelSemIgnorar = await useCase.verificarUsuarioDisponivel('usuario-1', DATA_HORA);

      expect(disponivelIgnorandoPropriaOS).toBe(true);
      expect(disponivelSemIgnorar).toBe(false);
    });

    it('nao considera conflito uma OS em horario diferente', async () => {
      const { useCase, ordemServicoRepository } = criarUseCase();
      ordemServicoRepository.seed(
        criarOrdemServicoFake({
          id: 'os-1',
          tecnicoId: 'usuario-1',
          dataAgendada: new Date('2026-08-10T15:00:00.000Z'),
        }),
      );

      const disponivel = await useCase.verificarUsuarioDisponivel('usuario-1', DATA_HORA);

      expect(disponivel).toBe(true);
    });
  });

  describe('listarTecnicosDisponiveis', () => {
    it('retorna apenas usuarios ativos, do papel informado, que estao livres no horario', async () => {
      const { useCase, ordemServicoRepository } = criarUseCase();

      const tecnicoLivre = criarUsuarioFake({ id: 'tecnico-livre', papel: 'tecnico' });
      const tecnicoOcupado = criarUsuarioFake({ id: 'tecnico-ocupado', papel: 'tecnico' });
      const tecnicoInativo = criarUsuarioFake({ id: 'tecnico-inativo', papel: 'tecnico', ativo: false });
      const ajudanteLivre = criarUsuarioFake({ id: 'ajudante-livre', papel: 'ajudante' });
      const atendente = criarUsuarioFake({ id: 'atendente-1', papel: 'atendente' });

      const usuarioRepository = criarUsuarioRepositoryFake([
        tecnicoLivre,
        tecnicoOcupado,
        tecnicoInativo,
        ajudanteLivre,
        atendente,
      ]);

      ordemServicoRepository.seed(
        criarOrdemServicoFake({ id: 'os-1', tecnicoId: 'tecnico-ocupado', dataAgendada: DATA_HORA }),
      );

      const disponiveis = await useCase.listarTecnicosDisponiveis(
        DATA_HORA,
        ['tecnico', 'ajudante'],
        usuarioRepository,
      );

      expect(disponiveis.map((usuario) => usuario.id).sort()).toEqual(['ajudante-livre', 'tecnico-livre']);
    });

    it('filtra apenas pelo papel informado (ex: somente ajudante)', async () => {
      const { useCase } = criarUseCase();

      const tecnicoLivre = criarUsuarioFake({ id: 'tecnico-livre', papel: 'tecnico' });
      const ajudanteLivre = criarUsuarioFake({ id: 'ajudante-livre', papel: 'ajudante' });

      const usuarioRepository = criarUsuarioRepositoryFake([tecnicoLivre, ajudanteLivre]);

      const disponiveis = await useCase.listarTecnicosDisponiveis(DATA_HORA, ['ajudante'], usuarioRepository);

      expect(disponiveis).toHaveLength(1);
      expect(disponiveis[0]?.id).toBe('ajudante-livre');
    });
  });
});
