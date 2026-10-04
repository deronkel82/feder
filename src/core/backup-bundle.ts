import { zipSync, strToU8 } from 'fflate';
import { validateLibrary } from './model.ts';

export async function backupBundle(data: unknown) {
  const library = validateLibrary(data);
  const images = new Map<string, { file: string; paths: string[] }>();
  const files: Record<string, Uint8Array> = {
    'Feder-Sicherung.json': strToU8(JSON.stringify(library, null, 2)),
  };
  async function visit(value: unknown, path: string) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++)
        await visit(value[i], `${path}[${i}]`);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      const location = path ? path + '.' + key : key;
      if (
        ['cover', 'alternativeCover', 'portrait'].includes(key) &&
        typeof entry === 'string' &&
        entry.startsWith('data:image/')
      ) {
        const existing = images.get(entry);
        if (existing) {
          existing.paths.push(location);
          continue;
        }
        const match = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(entry);
        if (!match)
          throw Error('Ein eingebettetes Bild konnte nicht gesichert werden.');
        const binary = atob(match[2]);
        const bytes = Uint8Array.from(binary, (character) =>
          character.charCodeAt(0),
        );
        const hash = [
          ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        ]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
        const file =
          'Bilder/' + hash + '.' + (match[1] === 'jpeg' ? 'jpg' : match[1]);
        files[file] = bytes;
        images.set(entry, { file, paths: [location] });
      } else await visit(entry, location);
    }
  }
  await visit(library, '');
  files['Bildzuordnung.json'] = strToU8(
    JSON.stringify([...images.values()], null, 2),
  );
  files['Lies-mich.txt'] = strToU8(
    'Feder-Sicherung.json enthält die vollständige Bibliothek einschließlich eingebetteter Bilder. Diese Datei in Feder importieren.\nBilder/ enthält die in Feder gespeicherten Bildfassungen zusätzlich als normale Bilddateien. Bildzuordnung.json zeigt ihre Verwendung in der JSON-Datei. Originalfotos vor Feder-Beschnitt/Verkleinerung werden von Feder nicht gespeichert.\n',
  );
  return zipSync(files, { level: 6 });
}
