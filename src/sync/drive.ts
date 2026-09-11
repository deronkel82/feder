import { validateLibrary, type Library } from '../core/model.ts';
export const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
export type RemoteRecord = { id: string; parents: string[]; date: string };
export class Drive {
  private token: string;
  constructor(token: string) {
    this.token = token;
  }
  async request(url: string, init: RequestInit = {}) {
    if (new URL(url).origin !== 'https://www.googleapis.com')
      throw Error('Ungültige Drive-Adresse.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + this.token);
    const response = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(90000),
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 401)
        throw Error('Google-Anmeldung abgelaufen. Bitte erneut verbinden.');
      if (response.status === 403)
        throw Error(
          'Drive-Zugriff abgelehnt. API-Aktivierung, Freigabe und Speicherplatz prüfen.',
        );
      throw Error(
        'Google Drive ist gerade nicht verfügbar (' +
          response.status +
          '). Lokale Daten bleiben erhalten.',
      );
    }
    return response;
  }
  async account() {
    const r = (await (
      await this.request(
        API + '/about?fields=user(permissionId,emailAddress,displayName)',
      )
    ).json()) as {
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
        fields: 'nextPageToken,files(id,description,createdTime)',
        pageSize: '1000',
        ...(page ? { pageToken: page } : {}),
      });
      const data = (await (await this.request(API + '/files?' + q)).json()) as {
        files?: { id: string; description: string; createdTime: string }[];
        nextPageToken?: string;
      };
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
          meta.protocol !== 1 ||
          !Array.isArray(meta.parents) ||
          !meta.parents.every((p: unknown) => typeof p === 'string')
        )
          throw Error('Unbekanntes Syncformat. Bitte Feder aktualisieren.');
        records.push({ id: f.id, parents: meta.parents, date: f.createdTime });
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
    const r = await this.request(
      API + '/files/' + encodeURIComponent(record.id) + '?alt=media',
    );
    const reader = r.body?.getReader();
    if (!reader) throw Error('Leerer Drive-Syncstand.');
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 100 * 1024 * 1024) {
          await reader.cancel();
          throw Error('Syncstand ist zu groß (max. 100 MB).');
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
      chunks.push(decoder.decode());
    } finally {
      reader.releaseLock();
    }
    const text = chunks.join('');
    const d = JSON.parse(text);
    if (
      !d ||
      d.protocol !== 1 ||
      JSON.stringify(d.parents) !== JSON.stringify(record.parents)
    )
      throw Error('Unvollständiger Syncstand.');
    return validateLibrary(d.library);
  }
  async create(library: Library, parents: string[]): Promise<string> {
    const payload = JSON.stringify({ protocol: 1, parents, library });
    if (new Blob([payload]).size > 100 * 1024 * 1024)
      throw Error('Bibliothek zu groß für diesen Sync (max. 100 MB).');
    const metadata = {
      name: 'Feder-Sync-' + crypto.randomUUID() + '.json',
      parents: ['appDataFolder'],
      mimeType: 'application/json',
      appProperties: { federSync: '1' },
      description: JSON.stringify({ protocol: 1, parents }),
    };
    // Only completed uploads become immutable records. Parallel writers create siblings, never overwrite each other.
    const start = await this.request(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      },
    );
    const location = start.headers.get('Location');
    if (!location) throw Error('Drive hat keinen Upload gestartet.');
    const result = (await (
      await this.request(location, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
    ).json()) as { id?: string };
    if (typeof result?.id !== 'string')
      throw Error('Drive hat den Syncstand nicht bestätigt.');
    return result.id;
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
