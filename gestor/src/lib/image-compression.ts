// artifacts/gestor/src/lib/image-compression.ts
// Compressão client-side de fotos de prato — extraído de catalogo.tsx pra ser
// reaproveitado também no onboarding de produtos (onboarding-produtos.tsx),
// sem duplicar a função nos dois lugares. Mesmo padrão de compressão usado no
// upload de logo/marca d'água da conta (App.tsx › BrandingOnboardingCard.compressImage):
// lê o arquivo, redesenha num canvas limitado a `max` px no maior lado e
// reexporta como data URI — assim a foto do prato nunca entra crua (e
// potencialmente enorme) no payload que vira snapshot JSONB. Usamos JPEG (em
// vez do PNG do logo) porque é foto real, não arte com transparência —
// comprime bem melhor.
export const MAX_PHOTO_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB — limite do arquivo bruto antes de comprimir

export function compressDishPhoto(file: File, max = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PHOTO_SOURCE_BYTES) {
      reject(new Error('Imagem muito grande (máx. 8MB). Escolha uma foto menor.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}
