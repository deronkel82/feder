import { validateLibrary, type Library } from '../core/model.ts';
import {
  pack,
  unpack,
  digest,
  isHash,
  MAX_SYNC_BYTES,
  MAX_BLOCKS,
} from './blocks.ts';
import { cachedBlock, cacheBlock } from './block-cache.ts';
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
export type RemoteRecord = {
  id: string;
  parents: string[];
  date: string;
  protocol?: 1 | 2;
};
class TransferError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}
function networkError(error: unknown): unknown {
  if (error instanceof TransferError) return error;
  if (
    error instanceof Error &&
    (['AbortError', 'TimeoutError', 'TypeError'].includes(error.name) ||
      /^fetch aborted$/i.test(error.message))
  )
    return new TransferError(
      error.name === 'TimeoutError'
        ? 'Übertragung nach 5 Minuten ohne Abschluss abgebrochen. Bitte Verbindung prüfen.'
        : 'Netzwerkübertragung unterbrochen. Bitte Feder geöffnet lassen und Verbindung prüfen.',
      true,
    );
  return error;
}
export class Drive {
  private token: string;
  private known = new Map<string, string>();
  private progress: (message: string) => void;
  private pause: (ms: number) => Promise<void>;
  constructor(
    token: string,
    progress: (message: string) => void = () => {},
    pause = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    this.token = token;
    this.progress = progress;
    this.pause = pause;
  }
  async request(url: string, init: RequestInit = {}, resume = false) {
    if (new URL(url).origin !== 'https://www.googleapis.com')
      throw Error('Ungültige Drive-Adresse.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + this.token);
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(300000),
        cache: 'no-store',
      });
    } catch (error) {
      throw networkError(error);
    }
    if (!response.ok && !(resume && response.status === 308)) {
      if (response.status === 401)
        throw new TransferError(
          'Google-Anmeldung abgelaufen. Bitte erneut verbinden.',
          false,
        );
      if (response.status === 403)
        throw new TransferError(
          'Drive-Zugriff abgelehnt. API-Aktivierung, Freigabe und Speicherplatz prüfen.',
          false,
        );
      throw new TransferError(
        'Google Drive antwortet mit Fehler ' +
          response.status +
          '. Bitte erneut synchronisieren.',
        response.status === 429 || response.status >= 500,
      );
    }
    return response;
  }
  async json(url: string, limit = MAX_SYNC_BYTES): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await this.request(url);
        const reader = r.body?.getReader();
        if (!reader) throw Error('Leerer Drive-Syncstand.');
        const decoder = new TextDecoder(),
          chunks: string[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) {
              await reader.cancel();
              throw Error('Syncdatei ist zu groß.');
            }
            chunks.push(decoder.decode(value, { stream: true }));
          }
          chunks.push(decoder.decode());
        } finally {
          reader.releaseLock();
        }
        return JSON.parse(chunks.join('')) as unknown;
      } catch (error) {
        const failure = networkError(error);
        if (
          !(failure instanceof TransferError) ||
          !failure.retryable ||
          attempt >= 2
        )
          throw failure;
        this.progress(
          'Verbindung unterbrochen – Download wird erneut versucht …',
        );
        await this.pause(500 * 2 ** attempt);
      }
    }
  }
  async account() {
    const r = (await this.json(
      API + '/about?fields=user(permissionId,emailAddress,displayName)',
    )) as {
      user?: {
        permissionId: string;
        emailAddress: string;
        displayName: string;
      };
    };
    if (typeof r?.user?.permissionId !== 'string')
      throw Error('Google-Konto konnte nicht geprüft werden.');
    return r.user as {
      permissionId: string;
      emailAddress: string;
      displayName: string;
    };
  }
  async list(): Promise<RemoteRecord[]> {
    const records: RemoteRecord[] = [];
    let page = '';
    const seen = new Set<string>();
    do {
      const q = new URLSearchParams({
        spaces: 'appDataFolder',
        q: "trashed = false and appProperties has { key='federSync' and value='1' }",
        fields:
          'nextPageToken,incompleteSearch,files(id,description,createdTime)',
        pageSize: '1000',
        ...(page ? { pageToken: page } : {}),
      });
      const data = (await this.json(API + '/files?' + q)) as {
        files?: { id: string; description: string; createdTime: string }[];
        nextPageToken?: string;
        incompleteSearch?: boolean;
      };
      if (data.incompleteSearch)
        throw Error(
          'Drive-Dateiliste unvollständig. Bitte erneut synchronisieren.',
        );
      if (!Array.isArray(data.files))
        throw Error('Ungültige Drive-Dateiliste.');
      for (const f of data.files || []) {
        if (typeof f.id !== 'string') throw Error('Ungültige Drive-Datei.');
        let meta;
        try {
          meta = JSON.parse(f.description);
        } catch {
          throw Error(
            'Ein Drive-Syncstand ist beschädigt. Synchronisierung angehalten.',
          );
        }
        if (
          !meta ||
          (meta.protocol !== 1 && meta.protocol !== 2) ||
          !Array.isArray(meta.parents) ||
          !meta.parents.every((p: unknown) => typeof p === 'string')
        )
          throw Error('Unbekanntes Syncformat. Bitte Feder aktualisieren.');
        records.push({
          id: f.id,
          parents: meta.parents,
          date: f.createdTime,
          protocol: meta.protocol,
        });
      }
      page = data.nextPageToken || '';
      if (
        page &&
        (typeof page !== 'string' || seen.has(page) || seen.size > 100)
      )
        throw Error('Drive-Dateiliste unvollständig.');
      seen.add(page);
    } while (page);
    return records;
  }
  async read(record: RemoteRecord): Promise<Library> {
    this.progress('Drive-Stand wird geprüft …');
    const d = (await this.json(
      API + '/files/' + encodeURIComponent(record.id) + '?alt=media',
    )) as {
      protocol?: number;
      parents?: unknown;
      library?: unknown;
      root?: string;
      blocks?: Record<string, string>;
    };
    if (
      !d ||
      (d.protocol !== 1 && d.protocol !== 2) ||
      (record.protocol !== undefined && record.protocol !== d.protocol) ||
      JSON.stringify(d.parents) !== JSON.stringify(record.parents)
    )
      throw Error('Unvollständiger Syncstand.');
    if (d.protocol === 1) return validateLibrary(d.library);
    if (
      !isHash(d.root) ||
      !d.blocks ||
      typeof d.blocks !== 'object' ||
      Array.isArray(d.blocks) ||
      Object.keys(d.blocks).length > MAX_BLOCKS ||
      Object.entries(d.blocks).some(
        ([hash, id]) => !isHash(hash) || typeof id !== 'string' || !id,
      )
    )
      throw Error('Ungültiges inkrementelles Syncformat.');
    let downloaded = 0;
    const blocks = d.blocks;
    const value = await unpack(d.root, async (hash) => {
      const id = blocks[hash];
      if (!id) throw Error('Unvollständiger Syncstand: Datenblock fehlt.');
      this.known.set(hash, id);
      const cached = await cachedBlock(hash);
      if (cached && (await digest(cached)) === hash) return cached;
      this.progress(`Geänderte Daten laden: Block ${++downloaded} …`);
      const text = JSON.stringify(
        await this.json(
          API + '/files/' + encodeURIComponent(id) + '?alt=media',
          4 * 1024 * 1024,
        ),
      );
      if ((await digest(text)) !== hash)
        throw Error('Beschädigter Sync-Datenblock.');
      await cacheBlock(hash, text);
      return text;
    });
    return validateLibrary(value);
  }
  private async discoverBlocks() {
    let page = '';
    const seen = new Set<string>();
    do {
      const q = new URLSearchParams({
        spaces: 'appDataFolder',
        q: "trashed = false and appProperties has { key='federBlock' and value='2' }",
        fields: 'nextPageToken,incompleteSearch,files(id,appProperties)',
        pageSize: '1000',
        ...(page ? { pageToken: page } : {}),
      });
      const data = (await this.json(API + '/files?' + q)) as {
        files?: { id: string; appProperties?: { hash?: string } }[];
        nextPageToken?: string;
        incompleteSearch?: boolean;
      };
      if (data.incompleteSearch)
        throw Error(
          'Drive-Dateiliste unvollständig. Bitte erneut synchronisieren.',
        );
      if (!Array.isArray(data.files))
        throw Error('Ungültige Drive-Dateiliste.');
      for (const file of data.files)
        if (typeof file.id === 'string' && isHash(file.appProperties?.hash))
          this.known.set(file.appProperties.hash, file.id);
      page = data.nextPageToken || '';
      if (
        page &&
        (typeof page !== 'string' || seen.has(page) || seen.size > 100)
      )
        throw Error('Drive-Dateiliste unvollständig.');
      seen.add(page);
    } while (page);
  }
  async create(library: Library, parents: string[]): Promise<string> {
    this.progress('Geänderte Datenblöcke werden ermittelt …');
    const packed = await pack(library);
    // Also reuse blocks from an earlier interrupted sync; no published head is
    // needed for these immutable, completed files.
    await this.discoverBlocks();
    const missing = [...packed.blocks].filter(
      ([hash]) => !this.known.has(hash),
    );
    let done = 0;
    for (const [hash, text] of missing) {
      const label = `Geänderte Daten hochladen: ${++done}/${missing.length}`;
      const id = await this.upload(
        text,
        {
          name: 'Feder-Block-' + hash + '.json',
          parents: ['appDataFolder'],
          mimeType: 'application/json',
          appProperties: { federBlock: '2', hash },
        },
        label,
      );
      this.known.set(hash, id);
      await cacheBlock(hash, text);
    }
    const blocks = Object.fromEntries(
      [...packed.blocks.keys()].map((hash) => [hash, this.known.get(hash)!]),
    );
    // The manifest is the commit: publish only after every block is confirmed.
    return this.upload(
      JSON.stringify({ protocol: 2, parents, root: packed.root, blocks }),
      {
        name: 'Feder-Sync-' + crypto.randomUUID() + '.json',
        parents: ['appDataFolder'],
        mimeType: 'application/json',
        appProperties: { federSync: '1' },
        description: JSON.stringify({ protocol: 2, parents }),
      },
      'Syncstand abschließen',
    );
  }
  async upload(
    text: string,
    metadata: Record<string, unknown>,
    label: string,
  ): Promise<string> {
    const payload = new Blob([text], { type: 'application/json' });
    const start = await this.request(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/json',
          'X-Upload-Content-Length': String(payload.size),
        },
        body: JSON.stringify(metadata),
      },
    );
    const location = start.headers.get('Location');
    if (!location) throw Error('Drive hat keinen Upload gestartet.');
    let offset = 0,
      failures = 0,
      probe = false;
    while (true) {
      this.progress(
        `${label} (${Math.floor((offset / payload.size) * 100)} %)`,
      );
      try {
        const end = Math.min(offset + 256 * 1024, payload.size);
        const response = await this.request(
          location,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Content-Range': probe
                ? `bytes */${payload.size}`
                : `bytes ${offset}-${end - 1}/${payload.size}`,
            },
            body: probe ? new Blob([]) : payload.slice(offset, end),
          },
          true,
        );
        if (response.status !== 308) {
          const result = (await response.json()) as { id?: string };
          if (typeof result.id !== 'string' || !result.id)
            throw Error('Drive hat den Syncstand nicht bestätigt.');
          return result.id;
        }
        const range = response.headers.get('Range');
        if (range !== null && !/^bytes=0-\d+$/.test(range))
          throw Error('Ungültige Upload-Bestätigung.');
        const next = range === null ? 0 : Number(range.slice(8)) + 1;
        if (
          !Number.isSafeInteger(next) ||
          next < offset ||
          next >= payload.size ||
          (!probe && next > end)
        )
          throw Error('Ungültige Upload-Position.');
        if (next === offset) {
          if (++failures > 3)
            throw Error(
              'Upload kommt nicht voran. Bitte erneut synchronisieren.',
            );
          await this.pause(500 * 2 ** (failures - 1));
        } else failures = 0;
        offset = next;
        probe = false;
      } catch (error) {
        const failure = networkError(error);
        if (
          !(failure instanceof TransferError) ||
          !failure.retryable ||
          ++failures > 3
        )
          throw Error(
            `${label}: ${failure instanceof Error ? failure.message : String(failure)}`,
          );
        this.progress(
          `${label}: Verbindung unterbrochen – bestätigten Stand prüfen …`,
        );
        await this.pause(500 * 2 ** (failures - 1));
        probe = true;
      }
    }
  }
  async remove(id: string) {
    await this.request(API + '/files/' + encodeURIComponent(id), {
      method: 'DELETE',
    });
  }
}
export function remoteHeads(records: RemoteRecord[]) {
  const byId = new Map(records.map((r) => [r.id, r]));
  if (byId.size !== records.length) throw Error('Doppelte Drive-Datei.');
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw Error('Ungültiger Drive-Verlauf.');
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    for (const parent of byId.get(id)!.parents) visit(parent);
    visiting.delete(id);
    visited.add(id);
  };
  for (const r of records) visit(r.id);
  const parents = new Set(records.flatMap((r) => r.parents));
  const heads = records.filter((r) => !parents.has(r.id));
  if (records.length && !heads.length) throw Error('Ungültiger Drive-Verlauf.');
  return heads.sort((a, b) => a.id.localeCompare(b.id));
}
