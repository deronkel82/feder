export type TransferProgress = {
  phase: string;
  completed: number;
  total: number | null;
  unit: 'bytes' | 'blocks';
  startedAt: number;
  elapsedSeconds: number;
  remainingSeconds: number | null;
};
export function createTransferProgress(
  notify: (value: TransferProgress) => void = () => {},
  now = () => Date.now(),
) {
  let value: TransferProgress | null = null;
  function emit() {
    if (!value) return;
    const elapsedSeconds = Math.max(0, (now() - value.startedAt) / 1000);
    const { completed, total } = value;
    value = {
      ...value,
      elapsedSeconds,
      remainingSeconds:
        total !== null && completed >= total
          ? 0
          : total !== null && completed > 0 && elapsedSeconds >= 1
            ? (elapsedSeconds * (total - completed)) / completed
            : null,
    };
    notify({ ...value });
  }
  return {
    begin(phase: string, total: number | null, unit: TransferProgress['unit']) {
      value = {
        phase,
        completed: 0,
        total,
        unit,
        startedAt: now(),
        elapsedSeconds: 0,
        remainingSeconds: null,
      };
      emit();
    },
    update(completed: number) {
      if (!value) return;
      value.completed = Math.max(
        value.completed,
        Math.min(completed, value.total ?? completed),
      );
      emit();
    },
    finish() {
      if (!value) return;
      if (value.total !== null) value.completed = value.total;
      emit();
    },
  };
}
export function remainingTime(value: TransferProgress, now = Date.now()) {
  if (value.total === null || value.completed <= 0) return null;
  if (value.completed >= value.total) return 0;
  const elapsed = Math.max(0, (now - value.startedAt) / 1000);
  return elapsed >= 1
    ? (elapsed * (value.total - value.completed)) / value.completed
    : null;
}
export function durationLabel(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return 'wird ermittelt …';
  if (seconds <= 0) return 'abgeschlossen';
  if (seconds < 60)
    return 'ca. ' + Math.max(5, Math.ceil(seconds / 5) * 5) + ' Sekunden';
  if (seconds < 3600) return 'ca. ' + Math.ceil(seconds / 60) + ' Minuten';
  return 'ca. ' + Math.ceil(seconds / 3600) + ' Stunden';
}
