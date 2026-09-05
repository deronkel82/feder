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
      reject(Error('Ein anderes Fenster blockiert die Datenbank.'));
  }));
}
export async function load(): Promise<{
  library: Library;
  error: string | null;
}> {
  try {
    const db = await database();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readwrite');
      const store = tx.objectStore('workspace');
      const r = store.get(KEY);
      let library: Library;
      let nextRevision = 0;
      r.onsuccess = () => {
        try {
          const record = r.result;
          const legacy = record ? null : localStorage.getItem(KEY);
          const raw = record?.library || (legacy ? JSON.parse(legacy) : null);
          library = raw ? validateLibrary(raw) : seed();
          nextRevision = record?.revision || 0;
          if (raw && raw.version !== library.version) {
            store.put(
              {
                date: new Date().toISOString(),
                reason: 'Vor Datenumstellung',
                library: raw,
              },
              'backup:migration:' + raw.version,
            );
            nextRevision++;
            store.put({ library, revision: nextRevision }, KEY);
          }
        } catch {
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        revision = nextRevision;
        resolve({ library: library!, error: null });
      };
      tx.onabort = () =>
        reject(
          Error(
            'Datenumstellung nicht möglich. Die Originaldaten bleiben unverändert.',
          ),
        );
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return {
      library: seed(),
      error:
        'Deine Daten konnten nicht sicher geöffnet oder umgestellt werden. Speichern ist angehalten. Unter „Projekte & Export“ kannst du Originaldaten und Update-Sicherungen herunterladen. Lösche keine Browserdaten.',
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
              ? 'Ein anderes Fenster hat Daten geändert. Sichere deine Arbeit als Datei und lade Feder neu.'
              : 'Speichern fehlgeschlagen. Bitte exportiere eine Sicherung.',
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
export async function backupForUpdate(library: Library) {
  await save(library);
  await queue;
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    const store = tx.objectStore('workspace');
    const r = store.get(KEY);
    r.onsuccess = () => {
      if (r.result?.revision !== revision) {
        tx.abort();
        return;
      }
      store.put(
        {
          date: new Date().toISOString(),
          reason: 'Vor App-Update',
          library: r.result.library,
        },
        'backup:update',
      );
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        Error(
          'Update-Sicherung fehlgeschlagen. Die aktuelle App bleibt geöffnet.',
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
}
export async function recoveryBackups() {
  const db = await database();
  return new Promise<
    Array<{ key: string; date: string; reason: string; library: unknown }>
  >((resolve, reject) => {
    const result: Array<{
      key: string;
      date: string;
      reason: string;
      library: unknown;
    }> = [];
    const r = db.transaction('workspace').objectStore('workspace').openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (!c) {
        resolve(result);
        return;
      }
      if (typeof c.key === 'string' && c.key.startsWith('backup:'))
        result.push({ key: c.key, ...c.value });
      c.continue();
    };
    r.onerror = () => reject(r.error);
  });
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
