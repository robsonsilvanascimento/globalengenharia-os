/**
 * Reduz a imagem escolhida no navegador antes de enviar ao servidor: encaixa
 * dentro de LADO_MAXIMO preservando a proporcao e reexporta como JPEG. Isso
 * mantem o upload leve e o PDF final rapido (JPEG decodifica bem mais rapido
 * que PNG no gerador). Retorna o data-URI base64 e o mime resultante.
 */
const LADO_MAXIMO = 1280;
const QUALIDADE = 0.72;

export interface ImagemReduzida {
  base64: string;
  mimeType: string;
}

export async function redimensionarImagem(arquivo: File): Promise<ImagemReduzida> {
  const dataUrl = await lerComoDataUrl(arquivo);
  const img = await carregarImagem(dataUrl);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const largura = Math.max(1, Math.round(img.width * escala));
  const altura = Math.max(1, Math.round(img.height * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Sem canvas disponivel: envia o original mesmo.
    return { base64: dataUrl, mimeType: arquivo.type || 'image/jpeg' };
  }
  ctx.drawImage(img, 0, 0, largura, altura);
  return { base64: canvas.toDataURL('image/jpeg', QUALIDADE), mimeType: 'image/jpeg' };
}

function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(arquivo);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Arquivo de imagem invalido'));
    img.src = src;
  });
}
