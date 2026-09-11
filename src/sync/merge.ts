import {
  newProject,
  validateLibrary,
  type Library,
  type Project,
  type Snapshot,
} from '../core/model.ts';
export function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + stable(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
const same = (a: unknown, b: unknown) => stable(a) === stable(b);
function suffix(value: unknown) {
  let h = 2166136261;
  for (const c of stable(value)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
export function mergeLibraries(
  base: Library | null,
  local: Library,
  remote: Library,
) {
  const conflicts: string[] = [];
  const remoteProjectIds = new Map<string, string>(),
    remoteWorldIds = new Map<string, string>();
  const purged = [
    ...new Set([
      ...(local.purgedProjectIds || []),
      ...(remote.purgedProjectIds || []),
    ]),
  ];
  function mergeList<T extends { id: string }>(
    old: T[],
    left: T[],
    right: T[],
    label: (v: T) => string,
    copy: (v: T, id: string) => T,
    mapping?: Map<string, string>,
  ): T[] {
    const out: T[] = [];
    const bm = new Map(old.map((x) => [x.id, x])),
      lm = new Map(left.map((x) => [x.id, x])),
      rm = new Map(right.map((x) => [x.id, x]));
    const order =
      base &&
      same(
        left.map((x) => x.id),
        old.map((x) => x.id),
      )
        ? [...right, ...left]
        : [...left, ...right];
    for (const id of new Set([
      ...order.map((x) => x.id),
      ...old.map((x) => x.id),
    ])) {
      const b = bm.get(id),
        l = lm.get(id),
        r = rm.get(id);
      if (same(l, r)) {
        if (l) out.push(l);
        continue;
      }
      if (base && same(l, b)) {
        if (r) out.push(r);
        continue;
      }
      if (base && same(r, b)) {
        if (l) out.push(l);
        continue;
      }
      if (!l || !r) {
        const remaining = l || r;
        if (remaining) {
          out.push(remaining);
          if (b) conflicts.push(label(remaining) + ' (Löschen/Bearbeiten)');
        }
        continue;
      }
      out.push(l);
      let newid = id + '-sync-' + suffix(r);
      while (
        (lm.has(newid) && !same(lm.get(newid), copy(r, newid))) ||
        rm.has(newid) ||
        out.some((v) => v.id === newid)
      )
        newid += '-copy';
      mapping?.set(id, newid);
      if (!lm.has(newid)) out.push(copy(r, newid));
      conflicts.push(label(r));
    }
    return out;
  }
  const worlds = mergeList(
    base?.worlds || [],
    local.worlds || [],
    remote.worlds || [],
    (w) => w.name,
    (w, id) => ({ ...w, id, name: w.name + ' (Konfliktkopie)' }),
    remoteWorldIds,
  );
  const remap = (p: Project) => ({
    ...p,
    ...(p.worldId && remoteWorldIds.has(p.worldId)
      ? { worldId: remoteWorldIds.get(p.worldId) }
      : {}),
  });
  const projects = mergeList(
    (base?.projects || []).filter((p) => !purged.includes(p.id)),
    local.projects.filter((p) => !purged.includes(p.id)),
    remote.projects.filter((p) => !purged.includes(p.id)).map(remap),
    (p) => p.title,
    (p, id) => ({ ...p, id, title: p.title + ' (Konfliktkopie)' }),
    remoteProjectIds,
  ).filter((p) => !purged.includes(p.id));
  if (!projects.length) projects.push(newProject('Neues Projekt'));
  const templates = mergeList(
    base?.templates || [],
    local.templates || [],
    remote.templates || [],
    (t) => t.name,
    (t, id) => ({ ...t, id, name: t.name + ' (Konfliktkopie)' }),
  );
  const snapshots = new Map<string, Snapshot>();
  for (const s of local.snapshots) snapshots.set(s.id, s);
  for (const s of remote.snapshots) {
    if (purged.includes(s.project.id)) continue;
    const project = {
      ...remap(s.project),
      id: remoteProjectIds.get(s.project.id) || s.project.id,
    };
    const next = { ...s, project };
    const old = snapshots.get(s.id);
    let id = old && !same(old, next) ? s.id + '-sync-' + suffix(next) : s.id;
    while (snapshots.has(id) && !same(snapshots.get(id), { ...next, id }))
      id += '-copy';
    snapshots.set(id, { ...next, id });
  }
  const defaultAuthor =
    base && local.defaultAuthor === base.defaultAuthor
      ? remote.defaultAuthor
      : (local.defaultAuthor ?? remote.defaultAuthor);
  const library = validateLibrary({
    ...local,
    defaultAuthor,
    projects,
    worlds,
    templates,
    purgedProjectIds: purged,
    snapshots: [...snapshots.values()].filter(
      (s) => !purged.includes(s.project.id),
    ),
    active: projects.some((p) => p.id === local.active)
      ? local.active
      : projects[0].id,
  });
  return { library, conflicts };
}
export function syncEqual(a: Library, b: Library) {
  return same({ ...a, active: '' }, { ...b, active: '' });
}
