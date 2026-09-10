import { validCover } from '../core/cover-data.ts';
export async function readCover(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.');
  if (file.size > 20 * 1024 * 1024)
    throw Error('Das Bild ist zu groß (maximal 20 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            Error('Das Bild lädt zu lange. Bitte ein anderes Bild versuchen.'),
          ),
        15000,
      );
      img.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(Error('Das Bild konnte nicht gelesen werden.'));
      };
      img.src = url;
    });
    if (
      !img.naturalWidth ||
      !img.naturalHeight ||
      img.naturalWidth * img.naturalHeight > 40000000
    )
      throw Error('Bitte ein kleineres Bild verwenden (maximal 40 Megapixel).');
    const ratio = Math.min(1, 768 / img.naturalWidth, 1152 / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Bildverarbeitung ist derzeit nicht verfügbar.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.65, 0.45]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (validCover(data)) return data;
    }
    throw Error(
      'Bitte ein kleineres oder weniger detailreiches Cover verwenden.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
