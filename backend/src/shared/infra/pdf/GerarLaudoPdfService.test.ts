import { describe, expect, it } from 'vitest';
import { gerarLaudoPdf } from './GerarLaudoPdfService';

function esperaAssinaturaPdf(buffer: Buffer): void {
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
}

// JPEG 4x4 valido (cor solida) para exercitar o embed real de imagem.
const JPEG_4X4 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAEAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkaKKK9w8w/9k=';
const jpegBuffer = Buffer.from(JPEG_4X4, 'base64');

const base = {
  numero: 'LT-2026-0007',
  titulo: 'Laudo Técnico de Sistema de Aterramento',
  subtitulo: 'Edifício Aurora — Bloco A',
  tipoRotulo: 'SPDA / para-raios (NBR 5419)',
  clienteNome: 'Condomínio Edifício Aurora',
  normasAplicaveis: 'ABNT NBR 5419:2015 — Proteção contra descargas atmosféricas\nABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
  emitidoEm: new Date('2026-07-18T18:00:00Z'),
  conteudo: '1. Objetivo\n\nAvaliar o aterramento conforme a NBR 5419.\n\n2. Conclusão\n\nAdequar a resistência.',
  responsavelNome: 'Eng. Fulano',
  responsavelCrea: 'CREA-SP nº 000',
  artNumero: '123456',
};

describe('gerarLaudoPdf', () => {
  it('gera um PDF valido com conteudo e bloco de responsabilidade tecnica', async () => {
    esperaAssinaturaPdf(await gerarLaudoPdf(base));
  });

  it('gera PDF valido com secoes numeradas, subsecoes, listas e caixa de nao conformidade', async () => {
    const conteudo = [
      '1. DADOS DE IDENTIFICAÇÃO',
      'Contratante: Condomínio Aurora',
      '2. OBJETO',
      'Inspeção do SPDA existente. As medições visam assegurar que:',
      '- O sistema está conforme o projeto;',
      '- As conexões estão firmes e livres de corrosão.',
      '3. NÃO CONFORMIDADES',
      '3.1 Continuidade da malha',
      '[NC] Baixada rompida no ponto 2, sem continuidade elétrica com a malha.',
      '[!] Recomenda-se a substituição do conector de medição por conector de bronze.',
    ].join('\n');
    esperaAssinaturaPdf(await gerarLaudoPdf({ ...base, conteudo }));
  });

  it('gera PDF valido sem cliente e sem dados de ART (campos a preencher)', async () => {
    esperaAssinaturaPdf(
      await gerarLaudoPdf({
        numero: 'LT-2026-0008',
        titulo: 'Laudo',
        emitidoEm: new Date(),
        conteudo: 'Texto do laudo.',
      }),
    );
  });

  it('gera PDF valido com conteudo longo (exercita a quebra de pagina)', async () => {
    const conteudo = Array.from({ length: 60 }, (_, i) => `Paragrafo ${i + 1} do laudo tecnico com texto suficiente para ocupar a linha.`).join('\n\n');
    esperaAssinaturaPdf(await gerarLaudoPdf({ ...base, conteudo }));
  });

  it('gera PDF valido com tabela de medicoes digitada no editor', async () => {
    const conteudo = [
      '5. MEDIÇÕES',
      'Medição de continuidade da malha em 3 pontos:',
      '| Ponto | Descrição | Medição | Unidade |',
      '| --- | --- | --- | --- |',
      '| 1 | Descida frontal | 0,52 | Ω |',
      '| 2 | Descida lateral | 0,49 | Ω |',
      '| 3 | Descida fundos | 0,55 | Ω |',
    ].join('\n');
    esperaAssinaturaPdf(await gerarLaudoPdf({ ...base, conteudo }));
  });

  it('gera PDF valido com relatorio fotografico (secao e sumario extra)', async () => {
    const pdf = await gerarLaudoPdf({
      ...base,
      fotos: [
        { buffer: jpegBuffer, mimeType: 'image/jpeg', legenda: 'Vista geral da cobertura' },
        { buffer: jpegBuffer, mimeType: 'image/jpeg', legenda: 'Detalhe do captor' },
        { buffer: Buffer.from('nao-e-imagem'), mimeType: 'image/jpeg', legenda: 'Arquivo corrompido' },
      ],
    });
    esperaAssinaturaPdf(pdf);
  });
});
