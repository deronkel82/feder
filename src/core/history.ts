import { uid, type Library, type Project, type Scene } from './model.ts';
export function withSnapshot(
  library: Library,
  project: Project,
  label: string,
  reason: 'manual' | 'revision' | 'restore' | 'delete' = 'manual',
  sceneId?: string,
): Library {
  const number =
    Math.max(
      library.snapshots.filter((s) => s.project.id === project.id).length,
      ...library.snapshots
        .filter((s) => s.project.id === project.id)
        .map((s) => s.number || 0),
    ) + 1;
  return {
    ...library,
    snapshots: [
      {
        id: uid(),
        date: new Date().toISOString(),
        project: structuredClone(project),
        label: label.trim() || `Version ${number}`,
        number,
        reason,
        sceneId,
      },
      ...library.snapshots,
    ],
  };
}
export function reviseScene(
  library: Library,
  sceneId: string,
  patch: Partial<Scene>,
  now = Date.now(),
): Library {
  const p = library.projects.find((p) => p.id === library.active)!;
  const s = p.scenes.find((s) => s.id === sceneId);
  if (!s) return library;
  const entering =
    patch.status === 'Überarbeitung' && s.status !== 'Überarbeitung';
  const changing =
    patch.text !== undefined &&
    patch.text !== s.text &&
    (s.status === 'Überarbeitung' || s.status === 'Fertig');
  const recent = library.snapshots.find(
    (v) =>
      v.project.id === p.id && v.sceneId === s.id && v.reason === 'revision',
  );
  let next = library;
  if (
    entering ||
    (changing && (!recent || now - Date.parse(recent.date) >= 10 * 60 * 1000))
  ) {
    next = withSnapshot(
      library,
      p,
      `Vor Überarbeitung: ${s.title}`,
      'revision',
      s.id,
    );
    next.snapshots[0].date = new Date(now).toISOString();
  }
  return {
    ...next,
    projects: next.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            updated: new Date(now).toISOString(),
            scenes: x.scenes.map((t) =>
              t.id === sceneId ? { ...t, ...patch } : t,
            ),
          }
        : x,
    ),
  };
}
export function restoreSnapshot(library: Library, id: string) {
  const old = library.snapshots.find((s) => s.id === id);
  if (!old) throw Error('Version nicht gefunden.');
  const current = library.projects.find((p) => p.id === old.project.id);
  if (!current) throw Error('Buch nicht gefunden.');
  const next = withSnapshot(
    library,
    current,
    'Vor Wiederherstellung',
    'restore',
  );
  return {
    ...next,
    projects: next.projects.map((p) =>
      p.id === current.id ? structuredClone(old.project) : p,
    ),
  };
}
