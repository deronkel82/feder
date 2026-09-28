import { validPortrait } from '../core/characters.ts';

export async function readPortrait(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.');
  if (file.size > 20 * 1024 * 1024)
    throw Error('Das Bild ist zu groß (maximal 20 MB).');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error('Das Bild lädt zu lange.')),
        15000,
      );
      image.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(Error('Das Bild konnte nicht gelesen werden.'));
      };
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40000000
    )
      throw Error('Bitte ein kleineres Bild verwenden (maximal 40 Megapixel).');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Bildverarbeitung ist derzeit nicht verfügbar.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 256, 256);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    for (const quality of [0.8, 0.65, 0.45, 0.3]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (validPortrait(data)) return data;
    }
    throw Error(
      'Das Bild ist zu detailreich. Bitte ein anderes Bild verwenden.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
