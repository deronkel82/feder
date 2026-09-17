/** Coalesce immutable states; write at most once per pause or maximum interval. */
export function createAutosave<T>(
  write: (value: T) => void,
  delay = 450,
  maxWait = 2000,
) {
  let pending: { value: T } | undefined;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(trailing);
    clearTimeout(deadline);
    trailing = deadline = undefined;
    const next = pending;
    pending = undefined;
    if (next) write(next.value);
  };
  return {
    schedule(value: T) {
      pending = { value };
      clearTimeout(trailing);
      trailing = setTimeout(flush, delay);
      deadline ??= setTimeout(flush, maxWait);
    },
    flush,
  };
}
