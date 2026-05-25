import { supabase } from "@/integrations/supabase/client";

type BrandingImageKind = "logo" | "hero" | "about" | "location";

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

const IMAGE_MAX_SIZE: Record<BrandingImageKind, { width: number; height: number }> = {
  logo: { width: 1200, height: 1200 },
  hero: { width: 2400, height: 1600 },
  about: { width: 1920, height: 1440 },
  location: { width: 1920, height: 1440 },
};

const isLikelyImage = (file: File) =>
  file.type.startsWith("image/") ||
  /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(file.name);

const loadImage = async (file: File): Promise<LoadedImage> => {
  if (!isLikelyImage(file)) {
    throw new Error("Envie um arquivo de imagem.");
  }

  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Some browser-supported formats, especially SVG, decode only through Image.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Formato de imagem nao suportado pelo navegador."));
    };
    image.src = url;
  });
};

const normalizeImage = async (file: File, kind: BrandingImageKind) => {
  const image = await loadImage(file);

  try {
    const max = IMAGE_MAX_SIZE[kind];
    const scale = Math.min(1, max.width / image.width, max.height / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Nao foi possivel tratar a imagem.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.94);
    });

    if (!blob) {
      throw new Error("Nao foi possivel converter a imagem.");
    }

    return new File([blob], `${kind}.webp`, { type: "image/webp" });
  } finally {
    image.cleanup();
  }
};

export async function uploadAgendaBrandingImage(
  ownerUserId: string,
  file: File,
  kind: BrandingImageKind,
) {
  let uploadFile: File;
  try {
    uploadFile = await normalizeImage(file, kind);
  } catch (error) {
    return {
      url: null as string | null,
      error: error instanceof Error ? error.message : "Nao foi possivel tratar a imagem.",
    };
  }

  const path = `${ownerUserId}/${kind}-${Date.now()}.webp`;

  const { error } = await supabase.storage.from("agenda-branding").upload(path, uploadFile, {
    cacheControl: "3600",
    contentType: uploadFile.type,
    upsert: true,
  });

  if (error) {
    return { url: null as string | null, error: error.message };
  }

  const { data } = supabase.storage.from("agenda-branding").getPublicUrl(path);
  return { url: data.publicUrl, error: null as string | null };
}
