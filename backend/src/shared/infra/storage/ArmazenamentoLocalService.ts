import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ArmazenamentoArquivoService,
  ArquivoNaoEncontradoError,
  ResultadoSalvarArquivo,
} from './ArmazenamentoArquivoService';

// __dirname aqui aponta para src/shared/infra/storage (em dev, via tsx) ou
// dist/shared/infra/storage (em producao, apos `npm run build`). Como o
// `tsc` espelha exatamente a estrutura de pastas de `src` dentro de `dist`
// (rootDir: src, outDir: dist), a profundidade de diretorios e identica nos
// dois casos. Por isso, subir 4 niveis a partir de __dirname sempre leva a
// raiz do pacote backend/, onde deve viver a pasta storage/ (irma de src/ e
// dist/). Mesma logica de robustez usada em GerarPdfOrdemServicoService.ts
// para resolver o caminho do logo.
function resolverDiretorioRaizPadrao(): string {
  return path.join(__dirname, '..', '..', '..', '..', 'storage');
}

/** Remove qualquer segmento de diretorio e caracteres fora de uma lista segura. */
function sanitizarNomeArquivo(nomeArquivo: string): string {
  const somenteNome = path.basename(nomeArquivo).trim();
  const sanitizado = somenteNome.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitizado.length > 0 ? sanitizado : 'arquivo';
}

/** Remove segmentos vazios, "." e ".." para impedir que a subpasta escape da raiz. */
function sanitizarSubpasta(subpasta: string): string {
  return subpasta
    .split(/[\\/]/)
    .map((segmento) => segmento.trim())
    .filter((segmento) => segmento.length > 0 && segmento !== '.' && segmento !== '..')
    .join('/');
}

/**
 * Implementacao de `ArmazenamentoArquivoService` usando o filesystem local.
 * Diretorio raiz configuravel via `STORAGE_DIR` (default: pasta `storage/`
 * na raiz do backend). Toda chave recebida (em `lerArquivo`/`remover`) e
 * resolvida e validada contra o diretorio raiz antes de tocar no filesystem,
 * para impedir path traversal mesmo se a chave vier de forma inesperada.
 */
export class ArmazenamentoLocalService implements ArmazenamentoArquivoService {
  private readonly diretorioRaiz: string;

  constructor(diretorioRaiz?: string) {
    const base = diretorioRaiz ?? process.env.STORAGE_DIR ?? resolverDiretorioRaizPadrao();
    this.diretorioRaiz = path.resolve(base);
  }

  async salvar(
    buffer: Buffer,
    nomeArquivo: string,
    subpasta = '',
  ): Promise<ResultadoSalvarArquivo> {
    const nomeSanitizado = sanitizarNomeArquivo(nomeArquivo);
    const subpastaSanitizada = sanitizarSubpasta(subpasta);
    const nomeFinal = `${randomUUID()}-${nomeSanitizado}`;
    const chave = subpastaSanitizada ? `${subpastaSanitizada}/${nomeFinal}` : nomeFinal;

    const caminhoAbsoluto = this.resolverCaminhoSeguro(chave);
    await fs.mkdir(path.dirname(caminhoAbsoluto), { recursive: true });
    await fs.writeFile(caminhoAbsoluto, buffer);

    return { chave };
  }

  async lerArquivo(chave: string): Promise<Buffer> {
    const caminhoAbsoluto = this.resolverCaminhoSeguro(chave);
    try {
      return await fs.readFile(caminhoAbsoluto);
    } catch {
      throw new ArquivoNaoEncontradoError(chave);
    }
  }

  async remover(chave: string): Promise<void> {
    let caminhoAbsoluto: string;
    try {
      caminhoAbsoluto = this.resolverCaminhoSeguro(chave);
    } catch {
      // Chave invalida/fora da raiz: do ponto de vista do chamador o
      // resultado e o mesmo de "arquivo inexistente" — nao ha nada a
      // remover, e a operacao deve permanecer idempotente.
      return;
    }

    try {
      await fs.unlink(caminhoAbsoluto);
    } catch (erro) {
      const codigo = (erro as NodeJS.ErrnoException)?.code;
      if (codigo !== 'ENOENT') {
        throw erro;
      }
    }
  }

  /**
   * Resolve a chave para um caminho absoluto e garante que ele esta contido
   * dentro do diretorio raiz de armazenamento. Lanca `ArquivoNaoEncontradoError`
   * caso contrario (ex: chave com "../" tentando escapar da raiz).
   */
  private resolverCaminhoSeguro(chave: string): string {
    const caminhoAbsoluto = path.resolve(this.diretorioRaiz, chave);
    const raizComSeparador = this.diretorioRaiz.endsWith(path.sep)
      ? this.diretorioRaiz
      : `${this.diretorioRaiz}${path.sep}`;

    const dentroDaRaiz =
      caminhoAbsoluto === this.diretorioRaiz || caminhoAbsoluto.startsWith(raizComSeparador);

    if (!dentroDaRaiz) {
      throw new ArquivoNaoEncontradoError(chave);
    }

    return caminhoAbsoluto;
  }
}
