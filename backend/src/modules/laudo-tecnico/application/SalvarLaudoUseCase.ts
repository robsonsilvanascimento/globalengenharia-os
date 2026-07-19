import { BadRequestError, NotFoundError } from '../../../shared/http/errors/AppError';
import type { Laudo, SalvarLaudoInput } from '../domain/Laudo';
import type { LaudoRepository } from '../domain/LaudoRepository';

/** Gera o numero do laudo no formato LT-AAAA-NNNN a partir da contagem do ano. */
function montarNumero(ano: number, sequencial: number): string {
  return `LT-${ano}-${String(sequencial).padStart(4, '0')}`;
}

export class SalvarLaudoUseCase {
  constructor(private readonly deps: { laudoRepository: LaudoRepository }) {}

  async execute(input: SalvarLaudoInput): Promise<Laudo> {
    if (!input.titulo.trim()) throw new BadRequestError('Informe o titulo do laudo');
    if (!input.conteudo.trim()) throw new BadRequestError('O laudo esta vazio');
    if (!input.tipo.trim()) throw new BadRequestError('Informe o tipo do laudo');

    const { laudoRepository } = this.deps;

    if (input.id) {
      const existente = await laudoRepository.buscarPorId(input.id);
      if (!existente) throw new NotFoundError('Laudo nao encontrado');
      return laudoRepository.atualizar(input.id, {
        ordemServicoId: input.ordemServicoId,
        titulo: input.titulo,
        subtitulo: input.subtitulo,
        tipo: input.tipo,
        clienteNome: input.clienteNome,
        normasAplicaveis: input.normasAplicaveis,
        conteudo: input.conteudo,
        responsavelNome: input.responsavelNome,
        responsavelCrea: input.responsavelCrea,
        artNumero: input.artNumero,
      });
    }

    const ano = new Date().getFullYear();
    const sequencial = (await laudoRepository.contarNoAno(ano)) + 1;

    return laudoRepository.criar({
      numero: montarNumero(ano, sequencial),
      ordemServicoId: input.ordemServicoId,
      titulo: input.titulo,
      subtitulo: input.subtitulo,
      tipo: input.tipo,
      clienteNome: input.clienteNome,
      normasAplicaveis: input.normasAplicaveis,
      conteudo: input.conteudo,
      responsavelNome: input.responsavelNome,
      responsavelCrea: input.responsavelCrea,
      artNumero: input.artNumero,
      criadoPorId: input.criadoPorId,
    });
  }
}
