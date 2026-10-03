import type { Library } from '../core/model.ts';
import type { Drive, RemoteRecord } from './drive.ts';
import { syncEqual } from './merge.ts';

// This interface cannot upload or delete. Rescue always proves that Drive,
// rather than this browser's optional cache, contains the complete library.
export async function readRecovery(
  drive: Pick<Drive, 'read'>,
  record: RemoteRecord,
): Promise<Library> {
  return drive.read(record, { cache: false });
}
export async function verifyRemoteBackup(
  drive: Pick<Drive, 'read'>,
  record: RemoteRecord,
  expected: Library,
) {
  const recovered = await readRecovery(drive, record);
  if (!syncEqual(recovered, expected))
    throw Error(
      'Drive-Sicherung stimmt nicht mit dem gesendeten Stand überein. Ältere Sicherungen bleiben erhalten.',
    );
}
export function recoveryOrder(records: RemoteRecord[]) {
  return [...records].sort(
    (a, b) =>
      (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id),
  );
}
