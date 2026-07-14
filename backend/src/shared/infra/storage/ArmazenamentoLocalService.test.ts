import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArmazenamentoLocalService } from './ArmazenamentoLocalService';
import { ArquivoNaoEncontradoError } from './ArmazenamentoArquivoService';

describe('ArmazenamentoLocalService', () => {
  let diretorioTemporario: string;
  let servico: ArmazenamentoLocalService;

  beforeAll(async () => {
    diretorioTemporario = await fs.mkdtemp(path.join(os.tmpdir(), 'armazenamento-teste-'));
    servico = new ArmazenamentoLocalService(diretorioTemporario);
  });

  afterAll(async () => {
    await fs.rm(diretorioTemporario, { recursive: true, force: true });
  });

  it('salva e depois le o mesmo conteudo', async () => {
    const conteudo = Buffer.from('conteudo de teste do arquivo');
    const { chave } = await servico.salvar(conteudo, 'documento.txt');

    expect(chave).toMatch(/^[0-9a-f-]+-documento\.txt$/);

    const lido = await servico.lerArquivo(chave);
    expect(lido.equals(conteudo)).toBe(true);
  });

  it('salva em subpasta e a chave reflete a subpasta', async () => {
    const conteudo = Buffer.from('conteudo em subpasta');
    const { chave } = await servico.salvar(conteudo, 'foto.png', 'clientes/123');

    expect(chave.startsWith('clientes/123/')).toBe(true);

    const lido = await servico.lerArquivo(chave);
    expect(lido.equals(conteudo)).toBe(true);
  });

  it('sanitiza nomes de arquivo perigosos', async () => {
    const conteudo = Buffer.from('conteudo com nome perigoso');
    const { chave } = await servico.salvar(conteudo, '../../etc/passwd');

    // O nome sanitizado nao deve conter separadores de diretorio.
    const nomeArmazenado = chave.split('/').pop() ?? '';
    expect(nomeArmazenado).not.toContain('/');
    expect(nomeArmazenado).not.toContain('..');

    const lido = await servico.lerArquivo(chave);
    expect(lido.equals(conteudo)).toBe(true);
  });

  it('remove um arquivo existente e a leitura subsequente falha', async () => {
    const conteudo = Buffer.from('arquivo a ser removido');
    const { chave } = await servico.salvar(conteudo, 'remover.txt');

    await servico.remover(chave);

    await expect(servico.lerArquivo(chave)).rejects.toBeInstanceOf(ArquivoNaoEncontradoError);
  });

  it('remover e idempotente: remover duas vezes nao lanca erro', async () => {
    const conteudo = Buffer.from('arquivo removido duas vezes');
    const { chave } = await servico.salvar(conteudo, 'duplo-remover.txt');

    await servico.remover(chave);
    await expect(servico.remover(chave)).resolves.toBeUndefined();
  });

  it('remover com chave que nunca existiu nao lanca erro', async () => {
    await expect(
      servico.remover(`${randomUUID()}-nunca-existiu.txt`),
    ).resolves.toBeUndefined();
  });

  it('ler uma chave inexistente rejeita com ArquivoNaoEncontradoError', async () => {
    await expect(servico.lerArquivo(`${randomUUID()}-inexistente.txt`)).rejects.toBeInstanceOf(
      ArquivoNaoEncontradoError,
    );
  });

  it('bloqueia tentativa de path traversal ao ler (../ escapando da raiz)', async () => {
    await expect(
      servico.lerArquivo('../../../../../../etc/passwd'),
    ).rejects.toBeInstanceOf(ArquivoNaoEncontradoError);
  });

  it('bloqueia tentativa de path traversal com caminho absoluto fora da raiz', async () => {
    const caminhoForaDaRaiz =
      process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd';

    await expect(servico.lerArquivo(caminhoForaDaRaiz)).rejects.toBeInstanceOf(
      ArquivoNaoEncontradoError,
    );
  });

  it('nao deixa uma chave de path traversal remover arquivo fora da raiz', async () => {
    // Cria um arquivo real fora do diretorio raiz de armazenamento para
    // confirmar que ele sobrevive a tentativa de remocao via traversal.
    const arquivoForaDaRaiz = path.join(os.tmpdir(), `fora-da-raiz-${randomUUID()}.txt`);
    await fs.writeFile(arquivoForaDaRaiz, 'nao deve ser removido');

    const nomeRelativo = path.relative(diretorioTemporario, arquivoForaDaRaiz);
    await servico.remover(nomeRelativo);

    const aindaExiste = await fs
      .access(arquivoForaDaRaiz)
      .then(() => true)
      .catch(() => false);
    expect(aindaExiste).toBe(true);

    await fs.rm(arquivoForaDaRaiz, { force: true });
  });

  it('usa STORAGE_DIR do ambiente quando nenhum diretorio e informado ao construtor', async () => {
    const diretorioEnv = await fs.mkdtemp(path.join(os.tmpdir(), 'armazenamento-env-'));
    const anterior = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = diretorioEnv;

    try {
      const servicoComEnv = new ArmazenamentoLocalService();
      const conteudo = Buffer.from('via STORAGE_DIR');
      const { chave } = await servicoComEnv.salvar(conteudo, 'via-env.txt');

      const lido = await servicoComEnv.lerArquivo(chave);
      expect(lido.equals(conteudo)).toBe(true);
    } finally {
      process.env.STORAGE_DIR = anterior;
      await fs.rm(diretorioEnv, { recursive: true, force: true });
    }
  });
});
