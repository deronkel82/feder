let indexPromise: Promise<{
  groups: string[][];
  index: Map<string, number[]>;
}> | null = null;
function normalize(s: string) {
  return s
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .toLocaleLowerCase('de');
}
self.onmessage = async (
  e: MessageEvent<{ id: number; query: string; url: string }>,
) => {
  const { id, query, url } = e.data;
  try {
    indexPromise ??= fetch(url)
      .then(async (r) => {
        if (!r.ok) throw Error('Wörterbuch nicht verfügbar');
        const groups = (await r.json()) as string[][];
        const index = new Map<string, number[]>();
        groups.forEach((g, i) =>
          g.forEach((term) => {
            const key = normalize(term);
            const ids = index.get(key) || [];
            if (ids.at(-1) !== i) ids.push(i);
            index.set(key, ids);
          }),
        );
        return { groups, index };
      })
      .catch((e) => {
        indexPromise = null;
        throw e;
      });
    const { groups, index } = await indexPromise;
    self.postMessage({
      id,
      groups: (index.get(normalize(query)) || [])
        .slice(0, 30)
        .map((i) => groups[i]),
    });
  } catch {
    self.postMessage({ id, error: true });
  }
};
export {};
