// Count the embedded image data, including historical versions and templates.
export function imageInventory(data: unknown) {
  const images = new Set<string>();
  let occurrences = 0;
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (
        ['cover', 'alternativeCover', 'portrait'].includes(key) &&
        typeof entry === 'string' &&
        entry.startsWith('data:image/')
      ) {
        images.add(entry);
        occurrences++;
      } else visit(entry);
    }
  }
  visit(data);
  return { unique: images.size, occurrences };
}
