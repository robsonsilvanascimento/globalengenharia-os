import type { Laudo as LaudoPrisma, PrismaClient } from '@prisma/client';
import type { Laudo } from '../domain/Laudo';
import type { AtualizarLaudoDados, CriarLaudoDados, LaudoRepository } from '../domain/LaudoRepository';

function paraEntidade(r: LaudoPrisma): Laudo {
  return {
    id: r.id,
    numero: r.numero,
    ordemServicoId: r.ordemServicoId,
    titulo: r.titulo,
    subtitulo: r.subtitulo,
    tipo: r.tipo,
    clienteNome: r.clienteNome,
    normasAplicaveis: r.normasAplicaveis,
    conteudo: r.conteudo,
    responsavelNome: r.responsavelNome,
    responsavelCrea: r.responsavelCrea,
    artNumero: r.artNumero,
    emitidoEm: r.emitidoEm,
    criadoPorId: r.criadoPorId,
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
  };
}

export class PrismaLaudoRepository implements LaudoRepository {
  constructor(private readonly client: PrismaClient) {}

  async criar(dados: CriarLaudoDados): Promise<Laudo> {
    const registro = await this.client.laudo.create({
      data: {
        numero: dados.numero,
        ordemServicoId: dados.ordemServicoId ?? null,
        titulo: dados.titulo,
        subtitulo: dados.subtitulo ?? null,
        tipo: dados.tipo,
        clienteNome: dados.clienteNome ?? null,
        normasAplicaveis: dados.normasAplicaveis ?? null,
        conteudo: dados.conteudo,
        responsavelNome: dados.responsavelNome ?? null,
        responsavelCrea: dados.responsavelCrea ?? null,
        artNumero: dados.artNumero ?? null,
        criadoPorId: dados.criadoPorId ?? null,
      },
    });
    return paraEntidade(registro);
  }

  async atualizar(id: string, dados: AtualizarLaudoDados): Promise<Laudo> {
    const registro = await this.client.laudo.update({
      where: { id },
      data: {
        ordemServicoId: dados.ordemServicoId,
        titulo: dados.titulo,
        subtitulo: dados.subtitulo,
        tipo: dados.tipo,
        clienteNome: dados.clienteNome,
        normasAplicaveis: dados.normasAplicaveis,
        conteudo: dados.conteudo,
        responsavelNome: dados.responsavelNome,
        responsavelCrea: dados.responsavelCrea,
        artNumero: dados.artNumero,
      },
    });
    return paraEntidade(registro);
  }

  async buscarPorId(id: string): Promise<Laudo | null> {
    const registro = await this.client.laudo.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async listarPorOrdemServico(ordemServicoId: string): Promise<Laudo[]> {
    const registros = await this.client.laudo.findMany({
      where: { ordemServicoId },
      orderBy: { criadoEm: 'desc' },
    });
    return registros.map(paraEntidade);
  }

  async contarNoAno(ano: number): Promise<number> {
    const inicio = new Date(ano, 0, 1);
    const fim = new Date(ano + 1, 0, 1);
    return this.client.laudo.count({ where: { criadoEm: { gte: inicio, lt: fim } } });
  }
}
