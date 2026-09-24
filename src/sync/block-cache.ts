// Disposable download cache. Failure/quota exhaustion must never block a sync.
// No Drive IDs or tokens are stored; every cache hit is checked against SHA-256.
let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('feder-sync-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blocks');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(Error('Sync-Cache nicht verfügbar.'));
  }));
}
export async function cachedBlock(hash: string): Promise<string | undefined> {
  try {
    const db = await database();
    return await new Promise((resolve, reject) => {
      const request = db.transaction('blocks').objectStore('blocks').get(hash);
      request.onsuccess = () =>
        resolve(
          typeof request.result?.text === 'string'
            ? request.result.text
            : undefined,
        );
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}
export async function cacheBlock(hash: string, text: string) {
  try {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('blocks', 'readwrite');
      const store = tx.objectStore('blocks');
      const total = store.get('bytes');
      const previous = store.get(hash);
      previous.onsuccess = () => {
        const size = new Blob([text]).size;
        let bytes =
          (Number(total.result) || 0) - (previous.result?.size || 0) + size;
        // Bound the optional cache so it cannot grow with every historical edit.
        if (bytes > 64 * 1024 * 1024) {
          store.clear();
          bytes = size;
        }
        store.put({ text, size }, hash);
        store.put(bytes, 'bytes');
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* Cache is optional; the authoritative copy is in Drive. */
  }
}
