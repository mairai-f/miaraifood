// Fotos de cardapio eram enviadas cruas (ate 5 MB) e servidas em tamanho
// original para cada cliente que abre o menu. Como a maior area de exibicao e
// um card, reduzimos para WebP com largura maxima antes do upload: corta o
// egress do Storage em uma ordem de grandeza e vale para sempre, sem depender
// de transformacao de imagem no servidor.

const MAX_DIMENSION = 1280;
const WEBP_QUALITY = 0.82;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nao foi possivel ler a imagem.'));
    };
    img.src = url;
  });

export interface CompressedImage {
  file: File;
  extension: string;
  contentType: string;
}

/**
 * Reduz a imagem para no maximo MAX_DIMENSION px no maior lado e converte para
 * WebP. Se algo falhar (formato exotico, canvas indisponivel), devolve o
 * arquivo original para nao bloquear o upload.
 */
export const compressImageForUpload = async (file: File): Promise<CompressedImage> => {
  const fallback: CompressedImage = {
    file,
    extension: file.name.split('.').pop() || 'jpg',
    contentType: file.type,
  };

  // GIF pode ser animado: recomprimir achataria a animacao.
  if (file.type === 'image/gif') return fallback;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    );
    if (!blob || blob.size >= file.size) return fallback;

    const baseName = file.name.replace(/\.[^.]+$/, '');
    return {
      file: new File([blob], `${baseName}.webp`, { type: 'image/webp' }),
      extension: 'webp',
      contentType: 'image/webp',
    };
  } catch {
    return fallback;
  }
};
