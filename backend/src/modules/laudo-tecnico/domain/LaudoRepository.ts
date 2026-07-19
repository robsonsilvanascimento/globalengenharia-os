import type { Laudo } from './Laudo';

export interface CriarLaudoDados {
  numero: string;
  ordemServicoId?: string | null;
  titulo: string;
  subtitulo?: string | null;
  tipo: string;
  clienteNome?: string | null;
  normasAplicaveis?: string | null;
  conteudo: string;
  responsavelNome?: string | null;
  responsavelCrea?: string | null;
  artNumero?: string | null;
  criadoPorId?: string;
}

export interface AtualizarLaudoDados {
  ordemServicoId?: string | null;
  titulo?: string;
  subtitulo?: string | null;
  tipo?: string;
  clienteNome?: string | null;
  normasAplicaveis?: string | null;
  conteudo?: string;
  responsavelNome?: string | null;
  responsavelCrea?: string | null;
  artNumero?: string | null;
}

export interface LaudoRepository {
  criar(dados: CriarLaudoDados): Promise<Laudo>;
  atualizar(id: string, dados: AtualizarLaudoDados): Promise<Laudo>;
  buscarPorId(id: string): Promise<Laudo | null>;
  listarPorOrdemServico(ordemServicoId: string): Promise<Laudo[]>;
  /** Quantidade de laudos emitidos no ano, usado para gerar o numero sequencial. */
  contarNoAno(ano: number): Promise<number>;
}
