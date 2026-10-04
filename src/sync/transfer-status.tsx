import { useEffect, useState } from 'react';
import {
  durationLabel,
  remainingTime,
  type TransferProgress,
} from './transfer-progress';
export function TransferStatus({
  progress,
  busy,
}: {
  progress: TransferProgress | null;
  busy: boolean;
}) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  if (!progress || !busy) return null;
  const remaining = remainingTime(
    progress,
    Math.max(clock, progress.startedAt + progress.elapsedSeconds * 1000),
  );
  const percent = progress.total
    ? Math.min(100, Math.floor((progress.completed / progress.total) * 100))
    : null;
  return (
    <div className="transfer-status">
      <strong>
        {progress.phase}
        {percent !== null ? ` · ${percent} %` : ''}
      </strong>
      {progress.total !== null && progress.total > 0 ? (
        <progress
          max={progress.total}
          value={progress.completed}
          aria-label={progress.phase}
        />
      ) : (
        <progress aria-label={progress.phase} />
      )}
      <span>
        Geschätzte Restdauer dieses Schritts: {durationLabel(remaining)}
      </span>
      <small>
        Die Schätzung passt sich an die Verbindung an. Vorbereitung, Übertragung
        und Prüfung werden getrennt angezeigt.
      </small>
    </div>
  );
}
