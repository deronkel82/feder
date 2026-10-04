import { validateLibrary, type Library } from '../core/model.ts';
import { Drive, type RemoteRecord } from './drive.ts';
import { verifyRemoteBackup } from './recovery.ts';

export async function replaceFromLocal(
  drive: Drive,
  data: Library,
  assertUnchanged: () => void = () => {},
) {
  const library = validateLibrary(data);
  const before = await drive.list({ recovery: true });
  const ids = before.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw Error('Doppelte Drive-Datei.');
  assertUnchanged();
  // A candidate is invisible to normal sync until a cold read proves that
  // every freshly uploaded block and the whole library can be restored.
  const id = await drive.create(library, ids, {
    fresh: true,
    staged: true,
    supersedes: ids,
  });
  const record: RemoteRecord = {
    id,
    parents: ids,
    supersedes: ids,
    protocol: 2,
    date: new Date().toISOString(),
  };
  await verifyRemoteBackup(drive, record, library);
  assertUnchanged();
  const after = await drive.list({ recovery: true });
  const signature = (records: RemoteRecord[]) =>
    JSON.stringify([...records].sort((a, b) => a.id.localeCompare(b.id)));
  if (signature(after) !== signature(before))
    throw Error(
      'Ein anderes Gerät hat den Drive-Stand geändert. Es wurde nichts ersetzt. Bitte dort den Sync pausieren und erneut versuchen.',
    );
  assertUnchanged();
  await drive.publishCandidate(id);
  return record;
}
