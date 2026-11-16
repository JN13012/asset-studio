export interface SourceImage {
  file: File;
  url: string;
  width: number;
  height: number;
}

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// Conservative initial limits to avoid accidental browser exhaustion.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PIXELS = 64_000_000;

export async function loadSourceImage(file: File): Promise<SourceImage> {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error('Format non pris en charge. Choisir PNG, JPEG ou WebP.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Le fichier dépasse 50 Mio.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > MAX_PIXELS) {
      throw new Error('Dimensions invalides ou supérieures à 64 mégapixels.');
    }
    return { file, url, width, height };
  } catch (error) {
    URL.revokeObjectURL(url);
    if (error instanceof Error) throw error;
    throw new Error('Impossible de lire cette image.');
  }
}
