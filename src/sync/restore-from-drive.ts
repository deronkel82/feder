import { validateLibrary, type Library } from '../core/model.ts';
import type { Drive, RemoteRecord } from './drive.ts';
import { activeRecords, remoteHeads } from './drive.ts';
import { mergeLibraries, stable, syncEqual } from './merge.ts';

export function repairIds(records: RemoteRecord[]) {
  return activeRecords(records)
    .filter((record) => record.supersedes !== undefined)
    .map((record) => record.id)
    .sort();
}
export function unseenRepairs(records: RemoteRecord[], checkpoint: unknown) {
  const acknowledged = (checkpoint as { repairs?: unknown } | null)?.repairs;
  return repairIds(records).filter(
    (id) => !Array.isArray(acknowledged) || !acknowledged.includes(id),
  );
}
export type DrivePreview = {
  library: Library;
  heads: RemoteRecord[];
  repairs: string[];
};
export async function readDrivePreview(
  drive: Pick<Drive, 'list' | 'read'>,
): Promise<DrivePreview> {
  const records = await drive.list({ recovery: true });
  const heads = remoteHeads(activeRecords(records));
  if (!heads.length)
    throw Error(
      'In diesem Google-Konto wurde keine aktive Feder-Sicherung gefunden. Bitte das Konto prüfen.',
    );
  if (heads.length > 20)
    throw Error(
      'Sehr viele parallele Drive-Stände. Bitte den Rettungsbereich verwenden.',
    );
  let library: Library | null = null;
  for (const head of heads) {
    const contents = await drive.read(head, { cache: false });
    library = library
      ? mergeLibraries(null, library, contents).library
      : contents;
  }
  return {
    library: validateLibrary(library),
    heads,
    repairs: repairIds(records),
  };
}
// Read-only on Drive: never publish a merge, upload local test data or delete history.
export async function restoreFromDrive(
  drive: Pick<Drive, 'list' | 'read'>,
  preview: DrivePreview,
  local: Library,
  key: string,
  commit: (
    library: Library,
    sync: { key: string; checkpoint: unknown; previous: Library },
  ) => Promise<void>,
  assertUnchanged: () => void = () => {},
) {
  assertUnchanged();
  const current = await readDrivePreview(drive);
  if (
    stable(current.heads) !== stable(preview.heads) ||
    !syncEqual(current.library, preview.library)
  )
    throw Error(
      'Die Drive-Sicherung hat sich seit der Vorschau geändert. Bitte erneut prüfen und bestätigen.',
    );
  assertUnchanged();
  const library = validateLibrary(current.library);
  const date = new Date().toISOString();
  await commit(library, {
    key,
    checkpoint: { base: library, date, repairs: current.repairs },
    previous: validateLibrary(local),
  });
  return { library, date };
}

// Preserve edits finishing during the IndexedDB commit, without reintroducing
// stale device deletion markers into the explicitly restored library.
export function preserveRestoreEdits(
  previous: Library,
  current: Library,
  restored: Library,
) {
  if (current === previous) return restored;
  const oldPurges = new Set(previous.purgedProjectIds || []);
  return mergeLibraries(
    { ...previous, purgedProjectIds: [] },
    {
      ...current,
      purgedProjectIds: (current.purgedProjectIds || []).filter(
        (id) => !oldPurges.has(id),
      ),
    },
    restored,
  ).library;
}
