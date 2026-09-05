import { seed, validateLibrary, type Library } from './model.ts';
const KEY = 'feder.library.v1';
let dbPromise: Promise<IDBDatabase> | null = null;
let revision = 0;
let queue = Promise.resolve();
function database() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('feder', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('workspace');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(Error('Datenbank wird von einem anderen Fenster blockiert.'));
  }));
}
export async function load(): Promise<{
  library: Library;
  error: string | null;
}> {
  try {
    const db = await database();
    const record = await new Promise<
      { library: Library; revision: number } | undefined
    >((resolve, reject) => {
      const r = db.transaction('workspace').objectStore('workspace').get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    revision = record?.revision || 0;
    const old = localStorage.getItem(KEY);
    return {
      library: record
        ? validateLibrary(record.library)
        : old
          ? validateLibrary(JSON.parse(old))
          : seed(),
      error: null,
    };
  } catch {
    return {
      library: seed(),
      error:
        'Gespeicherte Daten konnten nicht gelesen werden. Automatisches Speichern ist angehalten. Bitte öffne das ursprüngliche Browserprofil oder importiere eine Sicherung.',
    };
  }
}
export function save(library: Library) {
  const copy = structuredClone(library);
  const job = queue.then(async () => {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      const r = store.get(KEY);
      let conflict = false;
      r.onsuccess = () => {
        if ((r.result?.revision || 0) !== revision) {
          conflict = true;
          tx.abort();
          return;
        }
        store.put({ library: copy, revision: revision + 1 }, KEY);
      };
      tx.oncomplete = () => {
        revision++;
        resolve();
      };
      tx.onabort = () =>
        reject(
          Error(
            conflict
              ? 'Ein anderes Fenster hat dieses Projekt geändert. Exportiere deine Arbeit und lade die App neu, bevor du weiterarbeitest.'
              : 'Speichern fehlgeschlagen. Bitte exportiere eine Sicherung, bevor du die App schließt.',
          ),
        );
      tx.onerror = () =>
        reject(
          Error('Speicher nicht verfügbar. Bitte exportiere eine Sicherung.'),
        );
    });
  });
  queue = job.catch(() => {});
  return job;
}
export async function rawBackup() {
  const db = await database();
  return new Promise<string>((resolve, reject) => {
    const r = db.transaction('workspace').objectStore('workspace').get(KEY);
    r.onsuccess = () =>
      resolve(JSON.stringify(r.result?.library || {}, null, 2));
    r.onerror = () => reject(r.error);
  });
}
export function download(
  text: string,
  name: string,
  type = 'application/json',
) {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
export function safeName(s: string) {
  return s.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 80) || 'Manuskript';
}
