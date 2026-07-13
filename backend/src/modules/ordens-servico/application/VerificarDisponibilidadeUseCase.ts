import type { PapelUsuario, Usuario } from '../../auth/domain/Usuario';
import type { UsuarioRepository } from '../../auth/domain/UsuarioRepository';
import type { OrdemServicoRepository } from '../domain/OrdemServicoRepository';

export interface VerificarDisponibilidadeDeps {
  ordemServicoRepository: OrdemServicoRepository;
}

/**
 * Checagem de disponibilidade de tecnicos/ajudantes para agendamento de OS.
 * Depende apenas do contrato `OrdemServicoRepository` (domain) e, quando
 * necessario listar usuarios, recebe `UsuarioRepository` (tambem apenas o
 * tipo/interface de dominio de auth/) como parametro — nunca importa a
 * implementacao concreta de auth/infrastructure, evitando acoplamento entre
 * modulos.
 */
export class VerificarDisponibilidadeUseCase {
  constructor(private readonly deps: VerificarDisponibilidadeDeps) {}

  /**
   * Retorna `true` quando o usuario nao tem nenhuma OS (nao cancelada) conflitando
   * com `dataHora`, seja como tecnico ou como ajudante. Quando `ordemServicoIdParaIgnorar`
   * e informado, conflitos com essa mesma OS sao ignorados (util ao reeditar/reatribuir
   * a propria OS sem falso-positivo de conflito consigo mesma).
   */
  async verificarUsuarioDisponivel(
    usuarioId: string,
    dataHora: Date,
    ordemServicoIdParaIgnorar?: string,
  ): Promise<boolean> {
    const conflitos = await this.deps.ordemServicoRepository.buscarConflitosDeHorario(usuarioId, dataHora);

    const conflitosRelevantes = ordemServicoIdParaIgnorar
      ? conflitos.filter((ordemServico) => ordemServico.id !== ordemServicoIdParaIgnorar)
      : conflitos;

    return conflitosRelevantes.length === 0;
  }

  /**
   * Lista os usuarios ativos cujo papel esteja entre os informados (`tecnico`
   * e/ou `ajudante`) e que estejam livres em `dataHora`.
   */
  async listarTecnicosDisponiveis(
    dataHora: Date,
    papeis: Array<'tecnico' | 'ajudante'>,
    usuarioRepository: UsuarioRepository,
  ): Promise<Usuario[]> {
    const papeisPermitidos = papeis as PapelUsuario[];
    const todosUsuarios = await usuarioRepository.list();
    const candidatos = todosUsuarios.filter(
      (usuario) => usuario.ativo && papeisPermitidos.includes(usuario.papel),
    );

    const disponibilidades = await Promise.all(
      candidatos.map((usuario) => this.verificarUsuarioDisponivel(usuario.id, dataHora)),
    );

    return candidatos.filter((_, index) => disponibilidades[index]);
  }
}
