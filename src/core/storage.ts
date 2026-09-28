import { seed, validateLibrary, type Library, type Project } from './model.ts';
const KEY = 'feder.library.v1';
let dbPromise: Promise<IDBDatabase> | null = null;
let revision = 0;
let queue = Promise.resolve();
let persisted: Library | null = null;
type Index = {
  format: 2;
  revision: number;
  meta: Omit<Library, 'projects' | 'snapshots' | 'worlds' | 'templates'>;
  projects: { id: string; scenes: string[] }[];
  snapshots: string[];
};
const projectKey = (id: string) => 'project:' + id;
const sceneKey = (id: string, scene: string) => 'scene:' + id + ':' + scene;
const cardsKey = (id: string) => 'cards:' + id;
const coverKey = (id: string) => 'cover:' + id;
const snapshotKey = (id: string) => 'snapshot:' + id;
const extrasKey = 'workspace:extras';
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
async function readWorkspace(): Promise<{
  library: Library;
  revision: number;
}> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    const store = tx.objectStore('workspace');
    const r = store.get(KEY);
    let library: Library;
    let nextRevision = 0;
    r.onsuccess = () => {
      try {
        const record = r.result;
        nextRevision = record?.revision || 0;
        if (record?.format === 2) {
          const index = record as Index;
          const projects = new Map<string, Project>();
          const scenes = new Map<string, Project['scenes'][number]>();
          const cards = new Map<string, Project['cards']>();
          const covers = new Map<string, string>();
          const snapshots = new Map<string, Library['snapshots'][number]>();
          let extras: Pick<Library, 'worlds' | 'templates'> = {};
          const get = (key: string, receive: (value: unknown) => void) => {
            const request = store.get(key);
            request.onsuccess = () => receive(request.result);
          };
          get(extrasKey, (value) => {
            extras = (value as typeof extras) || {};
          });
          for (const p of index.projects) {
            get(projectKey(p.id), (value) =>
              projects.set(p.id, value as Project),
            );
            get(cardsKey(p.id), (value) =>
              cards.set(p.id, value as Project['cards']),
            );
            get(coverKey(p.id), (value) => {
              if (typeof value === 'string') covers.set(p.id, value);
            });
            for (const id of p.scenes)
              get(sceneKey(p.id, id), (value) =>
                scenes.set(
                  sceneKey(p.id, id),
                  value as Project['scenes'][number],
                ),
              );
          }
          for (const id of index.snapshots)
            get(snapshotKey(id), (value) =>
              snapshots.set(id, value as Library['snapshots'][number]),
            );
          tx.oncomplete = () => {
            try {
              library = validateLibrary({
                ...index.meta,
                ...extras,
                projects: index.projects.map((p) => ({
                  ...projects.get(p.id),
                  cards: cards.get(p.id),
                  ...(covers.has(p.id) ? { cover: covers.get(p.id) } : {}),
                  scenes: p.scenes.map((id) => scenes.get(sceneKey(p.id, id))),
                })),
                snapshots: index.snapshots.map((id) => snapshots.get(id)),
              });
              resolve({ library, revision: nextRevision });
            } catch (error) {
              reject(error);
            }
          };
          return;
        }
        const legacy = record ? null : localStorage.getItem(KEY);
        const raw = record?.library || (legacy ? JSON.parse(legacy) : null);
        library = raw ? validateLibrary(raw) : seed();
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
      resolve({ library: library!, revision: nextRevision });
    };
    tx.onabort = () =>
      reject(
        Error(
          'Datenumstellung nicht möglich. Die Originaldaten bleiben unverändert.',
        ),
      );
    tx.onerror = () => reject(tx.error);
  });
}
export async function load(): Promise<{
  library: Library;
  error: string | null;
}> {
  try {
    const result = await readWorkspace();
    revision = result.revision;
    persisted = result.library;
    return { library: result.library, error: null };
  } catch {
    return {
      library: seed(),
      error:
        'Deine Daten konnten nicht sicher geöffnet oder umgestellt werden. Speichern ist angehalten. Unter „Projekte & Export“ kannst du Originaldaten und Update-Sicherungen herunterladen. Lösche keine Browserdaten.',
    };
  }
}
export function save(
  library: Library,
  sync?: { key: string; checkpoint: unknown; previous?: Library },
) {
  sync = sync ? structuredClone(sync) : undefined;
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
        const old = persisted;
        // A caller may mutate the same library object before saving. In that
        // case write all parts; React's immutable edits take the fast path.
        const full = !old || old === library || r.result?.format !== 2;
        const oldProjects = new Map(old?.projects.map((p) => [p.id, p]));
        const oldSnapshots = new Map(old?.snapshots.map((s) => [s.id, s]));
        const currentIds = new Set(library.projects.map((p) => p.id));
        const currentSnapshots = new Set(library.snapshots.map((s) => s.id));
        const storedProjects: Index['projects'] =
          r.result?.format === 2 ? r.result.projects : [];
        for (const p of storedProjects) {
          if (!currentIds.has(p.id)) {
            store.delete(projectKey(p.id));
            store.delete(cardsKey(p.id));
            store.delete(coverKey(p.id));
          }
          const remaining = library.projects.find((item) => item.id === p.id);
          const sceneIds = new Set(remaining?.scenes.map((s) => s.id));
          for (const s of p.scenes)
            if (!sceneIds.has(s)) store.delete(sceneKey(p.id, s));
        }
        for (const id of r.result?.format === 2
          ? (r.result as Index).snapshots
          : [])
          if (!currentSnapshots.has(id)) store.delete(snapshotKey(id));
        for (const p of library.projects) {
          const previous = oldProjects.get(p.id);
          if (full || previous !== p) {
            const { scenes, cards: _cards, cover, ...meta } = p;
            store.put(
              {
                ...meta,
                ...(Object.hasOwn(p, 'cover') && cover === undefined
                  ? { cover: undefined }
                  : {}),
                scenes: scenes.map((s) => s.id),
              },
              projectKey(p.id),
            );
          }
          if (full || previous?.cards !== p.cards)
            store.put(p.cards, cardsKey(p.id));
          if (full || previous?.cover !== p.cover) {
            if (p.cover) store.put(p.cover, coverKey(p.id));
            else store.delete(coverKey(p.id));
          }
          const previousScenes = new Map(
            previous?.scenes.map((s) => [s.id, s]),
          );
          for (const s of p.scenes)
            if (full || previousScenes.get(s.id) !== s)
              store.put(s, sceneKey(p.id, s.id));
        }
        for (const s of library.snapshots)
          if (full || oldSnapshots.get(s.id) !== s)
            store.put(s, snapshotKey(s.id));
        if (
          full ||
          old?.worlds !== library.worlds ||
          old?.templates !== library.templates
        )
          store.put(
            {
              ...(Object.hasOwn(library, 'worlds')
                ? { worlds: library.worlds }
                : {}),
              ...(Object.hasOwn(library, 'templates')
                ? { templates: library.templates }
                : {}),
            },
            extrasKey,
          );
        const {
          projects,
          snapshots,
          worlds: _worlds,
          templates: _templates,
          ...meta
        } = library;
        store.put(
          {
            format: 2,
            revision: revision + 1,
            meta,
            projects: projects.map((p) => ({
              id: p.id,
              scenes: p.scenes.map((s) => s.id),
            })),
            snapshots: snapshots.map((s) => s.id),
          } satisfies Index,
          KEY,
        );
        if (sync) {
          store.put(sync.checkpoint, sync.key);
          if (sync.previous)
            store.put(
              {
                date: new Date().toISOString(),
                reason: 'Vor Synchronisierung',
                library: sync.previous,
              },
              'backup:sync',
            );
        }
        const previousPurges: string[] =
          r.result?.format === 2
            ? r.result.meta.purgedProjectIds || []
            : r.result?.library?.purgedProjectIds || [];
        const purged = new Set(
          (library.purgedProjectIds || []).filter(
            (id) => !previousPurges.includes(id),
          ),
        );
        if (purged.size) {
          for (const prefix of ['backup:', 'sync:']) {
            const cursor = store.openCursor(
              IDBKeyRange.bound(prefix, prefix + '\uffff'),
            );
            cursor.onsuccess = () => {
              const c = cursor.result;
              if (!c) return;
              if (typeof c.key === 'string' && c.key.startsWith('backup:')) {
                const backup = c.value;
                if (Array.isArray(backup.library?.projects)) {
                  backup.library.projects = backup.library.projects.filter(
                    (p: Project) => !purged.has(p.id),
                  );
                  backup.library.snapshots = (
                    backup.library.snapshots || []
                  ).filter(
                    (s: { project: Project }) => !purged.has(s.project.id),
                  );
                  if (!backup.library.projects.length) c.delete();
                  else {
                    if (
                      !backup.library.projects.some(
                        (p: Project) => p.id === backup.library.active,
                      )
                    )
                      backup.library.active = backup.library.projects[0].id;
                    c.update(backup);
                  }
                }
              }
              if (
                typeof c.key === 'string' &&
                c.key.startsWith('sync:') &&
                c.value?.base
              ) {
                const record = c.value;
                record.base.projects = record.base.projects.filter(
                  (p: Project) => !purged.has(p.id),
                );
                record.base.snapshots = record.base.snapshots.filter(
                  (s: { project: Project }) => !purged.has(s.project.id),
                );
                record.base.purgedProjectIds = [
                  ...new Set([
                    ...(record.base.purgedProjectIds || []),
                    ...purged,
                  ]),
                ];
                if (!record.base.projects.length) record.base = null;
                else if (
                  !record.base.projects.some(
                    (p: Project) => p.id === record.base.active,
                  )
                )
                  record.base.active = record.base.projects[0].id;
                c.update(record);
              }
              c.continue();
            };
          }
        }
      };
      tx.oncomplete = () => {
        revision++;
        persisted = library;
        resolve();
      };
      tx.onabort = () => {
        persisted = null;
        reject(
          Error(
            conflict
              ? 'Ein anderes Fenster hat Daten geändert. Sichere deine Arbeit als Datei und lade Feder neu.'
              : 'Speichern fehlgeschlagen. Bitte exportiere eine Sicherung. ' +
                  (tx.error?.message || ''),
          ),
        );
      };
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
          library,
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
  try {
    return JSON.stringify((await readWorkspace()).library, null, 2);
  } catch {
    // An unsupported legacy version still needs to be downloadable verbatim.
    const db = await database();
    return new Promise<string>((resolve, reject) => {
      const r = db.transaction('workspace').objectStore('workspace').get(KEY);
      r.onsuccess = () =>
        resolve(JSON.stringify(r.result?.library || r.result || {}, null, 2));
      r.onerror = () => reject(r.error);
    });
  }
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

export async function readSyncCheckpoint(key: string): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('workspace').objectStore('workspace').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
