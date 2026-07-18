import { describe, expect, it } from 'vitest';
import { gerarRelatorioFotografico, type FotoRelatorio } from './GerarRelatorioFotograficoService';

// JPEG 8x8 valido, base64. Usa-se JPEG de proposito: o pdfkit decodifica PNG
// com uma implementacao JS pura (png-js) que e ordens de grandeza mais lenta,
// a ponto de estourar o timeout do teste com imagens de tamanho real.
const JPEG_8X8 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCnRRRXYch//9k=';

function foto(momento: FotoRelatorio['momento'], legenda: string | null = null): FotoRelatorio {
  return { base64: JPEG_8X8, mimeType: 'image/jpeg', legenda, momento };
}

function esperaAssinaturaPdf(buffer: Buffer): void {
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString('utf-8')).toBe('%PDF');
}

const dadosBase = {
  numeroOS: 'OS-2026-000042',
  clienteNome: 'João Pereira Santos',
  emitidoEm: new Date('2026-07-18T16:40:00Z'),
};

describe('gerarRelatorioFotografico', () => {
  it('gera um PDF valido com fotos antes e depois', async () => {
    const buffer = await gerarRelatorioFotografico({
      ...dadosBase,
      fotos: [foto('antes', 'Quadro antigo'), foto('depois', 'Quadro novo')],
    });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido quando so ha fotos de um momento', async () => {
    const buffer = await gerarRelatorioFotografico({
      ...dadosBase,
      fotos: [foto('antes'), foto('antes')],
    });
    esperaAssinaturaPdf(buffer);
  });

  it('trata fotos sem momento (null) como "depois"', async () => {
    // Nao ha como inspecionar o layout do PDF aqui; o teste garante que fotos
    // sem marcacao nao quebram a geracao (sao roteadas para a secao "Depois").
    const buffer = await gerarRelatorioFotografico({
      ...dadosBase,
      fotos: [foto(null), foto('antes')],
    });
    esperaAssinaturaPdf(buffer);
  });

  it('nao quebra quando uma foto tem base64 invalido (cai para aviso na celula)', async () => {
    const buffer = await gerarRelatorioFotografico({
      ...dadosBase,
      fotos: [
        foto('antes', 'ok'),
        { base64: 'nao-e-base64-de-imagem', mimeType: 'image/png', legenda: 'quebrada', momento: 'depois' },
      ],
    });
    esperaAssinaturaPdf(buffer);
  });

  it('gera PDF valido com muitas fotos (exercita a quebra de pagina)', async () => {
    const fotos = Array.from({ length: 14 }, (_, i) =>
      foto(i % 2 === 0 ? 'antes' : 'depois', `Foto ${i + 1}`),
    );
    const buffer = await gerarRelatorioFotografico({ ...dadosBase, fotos });
    esperaAssinaturaPdf(buffer);
  });
});
