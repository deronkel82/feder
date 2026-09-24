import { stable } from './merge.ts';

// Content-addressed JSON tree: a scene edit does not resend covers, other
// books or historical versions. Small values stay together to limit API calls.
export const MAX_SYNC_BYTES = 100 * 1024 * 1024;
export const MAX_BLOCKS = 20000;
const INLINE_BYTES = 64 * 1024;
type Node =
  | { kind: 'value'; value: unknown }
  | { kind: 'object'; entries: [string, string][] }
  | { kind: 'array' | 'string'; parts: string[] };
export async function digest(text: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export const isHash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export async function pack(value: unknown) {
  const blocks = new Map<string, string>();
  if (new Blob([JSON.stringify(value)]).size > MAX_SYNC_BYTES)
    throw Error('Bibliothek zu groß für diesen Sync (max. 100 MB).');
  async function visit(value: unknown, depth = 0): Promise<string> {
    if (depth > 64) throw Error('Syncdaten sind zu tief verschachtelt.');
    const serialized = stable(value);
    let node: Node;
    if (depth > 0 && new Blob([serialized]).size <= INLINE_BYTES) {
      node = { kind: 'value', value: JSON.parse(serialized) };
    } else if (typeof value === 'string') {
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += 16000)
        parts.push(await visit(value.slice(i, i + 16000), depth + 1));
      node = { kind: 'string', parts };
    } else if (Array.isArray(value)) {
      const parts: string[] = [];
      for (const item of value) parts.push(await visit(item, depth + 1));
      node = { kind: 'array', parts };
    } else if (value && typeof value === 'object') {
      const entries: [string, string][] = [];
      for (const key of Object.keys(value).sort()) {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined)
          entries.push([key, await visit(item, depth + 1)]);
      }
      node = { kind: 'object', entries };
    } else node = { kind: 'value', value };
    const text = JSON.stringify(node);
    if (new Blob([text]).size > 4 * 1024 * 1024)
      throw Error('Ein Sync-Datenblock enthält zu viele Einträge.');
    const hash = await digest(text);
    blocks.set(hash, text);
    if (blocks.size > MAX_BLOCKS) throw Error('Zu viele Sync-Datenblöcke.');
    return hash;
  }
  const root = await visit(value);
  return { root, blocks };
}

export async function unpack(
  root: string,
  get: (hash: string) => Promise<string>,
) {
  let expandedBytes = 0,
    visits = 0;
  const ancestors = new Set<string>();
  const nodes = new Map<string, Node>();
  async function visit(hash: string, depth = 0): Promise<unknown> {
    if (!isHash(hash) || depth > 64 || ancestors.has(hash) || ++visits > 200000)
      throw Error('Ungültige Verknüpfung in den Syncdaten.');
    ancestors.add(hash);
    try {
      let node = nodes.get(hash);
      if (!node) {
        const text = await get(hash);
        if ((await digest(text)) !== hash)
          throw Error('Beschädigter Sync-Datenblock.');
        node = JSON.parse(text) as Node;
        nodes.set(hash, node);
      }
      if (!node || typeof node !== 'object')
        throw Error('Ungültiger Sync-Datenblock.');
      // Count expanded references as well, not just unique downloaded bytes.
      expandedBytes += new Blob([JSON.stringify(node)]).size;
      if (expandedBytes > MAX_SYNC_BYTES * 2)
        throw Error('Syncstand ist zu groß.');
      if (node.kind === 'value' && Object.hasOwn(node, 'value'))
        return node.value;
      if (node.kind === 'object' && Array.isArray(node.entries)) {
        const result: Record<string, unknown> = Object.create(null);
        for (const entry of node.entries) {
          if (
            !Array.isArray(entry) ||
            entry.length !== 2 ||
            typeof entry[0] !== 'string' ||
            Object.hasOwn(result, entry[0])
          )
            throw Error('Ungültiger Sync-Datenblock.');
          result[entry[0]] = await visit(entry[1], depth + 1);
        }
        return result;
      }
      if (
        (node.kind === 'array' || node.kind === 'string') &&
        Array.isArray(node.parts)
      ) {
        const parts: unknown[] = [];
        for (const part of node.parts) parts.push(await visit(part, depth + 1));
        if (node.kind === 'array') return parts;
        if (!parts.every((part) => typeof part === 'string'))
          throw Error('Ungültiger Synctext.');
        return parts.join('');
      }
      throw Error('Unbekannter Sync-Datenblock. Bitte Feder aktualisieren.');
    } finally {
      ancestors.delete(hash);
    }
  }
  const value = await visit(root);
  if (new Blob([JSON.stringify(value)]).size > MAX_SYNC_BYTES)
    throw Error('Syncstand ist zu groß (max. 100 MB).');
  return value;
}
