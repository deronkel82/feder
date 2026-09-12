import {
  CloudCheck,
  CloudOff,
  CloudUpload,
  CloudAlert,
  LoaderCircle,
} from 'lucide-react';
import type { DriveSync } from './use-drive-sync';
export function SyncStatus({
  sync,
  open,
}: {
  sync: DriveSync;
  open: () => void;
}) {
  const status = sync.status;
  const Icon =
    status === 'offline'
      ? CloudOff
      : status === 'synced'
        ? CloudCheck
        : status === 'busy'
          ? LoaderCircle
          : status === 'auth' || status === 'attention'
            ? CloudAlert
            : CloudUpload;
  const labels = {
    offline: 'Offline',
    synced: 'Stand abgeglichen',
    busy: 'Sync läuft',
    auth: 'Anmeldung erforderlich',
    attention: 'Sync prüfen',
    pending: 'Änderungen vorhanden',
  };
  return (
    <button
      className={'sync-status sync-' + status}
      onClick={open}
      title={
        labels[status] +
        (sync.lastSync
          ? ' · Letzter Abgleich ' +
            new Date(sync.lastSync).toLocaleString('de')
          : '')
      }
      aria-label={'Google Drive: ' + labels[status]}
    >
      <Icon size={18} />
    </button>
  );
}
