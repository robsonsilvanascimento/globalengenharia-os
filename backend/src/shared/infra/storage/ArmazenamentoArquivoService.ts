/**
 * Abstracao de armazenamento de arquivos. Quem consome este servico nunca
 * deve depender de detalhes de implementacao (disco local, S3, etc.) — apenas
 * da "chave" logica retornada por `salvar`, que e opaca para o chamador e
 * usada depois para ler/remover o arquivo. Trocar a implementacao (ex: de
 * `ArmazenamentoLocalService` para uma futura `ArmazenamentoS3Service`) nao
 * deve exigir nenhuma mudanca em quem usa esta interface.
 */
export interface ResultadoSalvarArquivo {
  /** Identificador logico do arquivo salvo (NAO e o caminho absoluto em disco). */
  chave: string;
}

export interface ArmazenamentoArquivoService {
  /**
   * Salva o conteudo do arquivo e retorna a chave logica que o identifica.
   * @param buffer Conteudo binario do arquivo.
   * @param nomeArquivo Nome original do arquivo (usado apenas para compor a
   * chave; sera sanitizado pela implementacao).
   * @param subpasta Subpasta logica opcional para organizar os arquivos
   * (ex: "clientes/123").
   */
  salvar(buffer: Buffer, nomeArquivo: string, subpasta?: string): Promise<ResultadoSalvarArquivo>;

  /**
   * Le o conteudo do arquivo identificado pela chave.
   * @throws {ArquivoNaoEncontradoError} se a chave nao existir ou for invalida
   * (incluindo tentativas de path traversal).
   */
  lerArquivo(chave: string): Promise<Buffer>;

  /**
   * Remove o arquivo identificado pela chave. Idempotente: nao lanca erro
   * caso o arquivo ja nao exista (ou a chave seja invalida).
   */
  remover(chave: string): Promise<void>;
}

/** Erro tipado lancado quando a chave informada nao aponta para um arquivo valido. */
export class ArquivoNaoEncontradoError extends Error {
  public readonly chave: string;

  constructor(chave: string) {
    super(`Arquivo nao encontrado para a chave informada: ${chave}`);
    this.name = 'ArquivoNaoEncontradoError';
    this.chave = chave;
  }
}
