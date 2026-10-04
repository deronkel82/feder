import { useRef, useState } from 'react';
import { validateLibrary, type Library } from '../core/model';
import { download, rawBackup, restoreLibrary } from '../core/storage';
import { Drive, type RemoteRecord } from './drive';
import { authorize, loadGoogle } from './google';
import { GOOGLE_CLIENT_ID } from './config';
import { readRecovery, recoveryOrder } from './recovery';
import type { TransferProgress } from './transfer-progress';
import { TransferStatus } from './transfer-status';
import { imageInventory } from '../core/image-inventory';
import { backupBundle } from '../core/backup-bundle';

export function RecoveryTools({
  allowRestore = false,
}: {
  allowRestore?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState('');
  const [message, setMessage] = useState('');
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [records, setRecords] = useState<RemoteRecord[]>([]);
  const [limit, setLimit] = useState(20);
  const [preview, setPreview] = useState<{
    library: Library;
    label: string;
  } | null>(null);
  const drive = useRef<Drive | null>(null);
  async function connect() {
    setBusy(true);
    setPreview(null);
    try {
      const auth = await authorize(GOOGLE_CLIENT_ID);
      drive.current = new Drive(auth.token, setMessage, undefined, setTransfer);
      const user = await drive.current.account();
      setAccount(user.emailAddress || user.displayName);
      setMessage('Vorhandene Drive-Sicherungen suchen …');
      const list = recoveryOrder(await drive.current.list({ recovery: true }));
      setRecords(list);
      setMessage(
        list.length
          ? 'Wähle einen Stand zur vollständigen Prüfung. Auch ältere Stände bleiben auswählbar.'
          : 'Für dieses Google-Konto wurden keine Feder-Sicherungen gefunden. Prüfe, ob Thorsten ein anderes Konto verwendet hat.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function inspect(record: RemoteRecord) {
    if (!drive.current) return;
    setBusy(true);
    setTransfer(null);
    setPreview(null);
    try {
      const library = await readRecovery(drive.current, record);
      setPreview({
        library,
        label: record.date
          ? new Date(record.date).toLocaleString('de')
          : record.id,
      });
      setMessage(
        'Alle benötigten Datenblöcke wurden aus Drive geladen, ihre Prüfsummen und die vollständige Bibliothek geprüft.',
      );
    } catch (error) {
      setMessage(
        'Dieser Stand konnte nicht vollständig geprüft werden: ' +
          (error as Error).message +
          ' Du kannst einen anderen Stand auswählen.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!preview) return;
    setBusy(true);
    try {
      // Independent export remains available even if local storage is full.
      download(
        JSON.stringify(preview.library, null, 2),
        'Feder-Gepruefte-Sicherung.json',
      );
      download(await rawBackup(), 'Feder-Originaldaten-vor-Rettung.json');
      await restoreLibrary(preview.library);
      location.reload();
    } catch (error) {
      setMessage((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="drive-recovery" aria-label="Daten wiederherstellen">
      <h2>Google-Drive-Sicherung retten</h2>
      <p>
        Mit demselben Google-Konto anmelden. Die Rettung liest vorhandene
        Sicherungen; sie lädt nichts nach Drive hoch und löscht dort nichts.
      </p>
      {!ready ? (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await loadGoogle();
              setReady(true);
              setMessage('Google-Anmeldung bereit.');
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Google-Anmeldung vorbereiten
        </button>
      ) : (
        <button disabled={busy} onClick={connect}>
          Google-Konto wählen & Sicherungen suchen
        </button>
      )}
      {account && <p>Konto: {account}</p>}
      <div className="recovery-records">
        {records.slice(0, limit).map((record) => (
          <button
            key={record.id}
            disabled={busy || !!record.invalid}
            onClick={() => inspect(record)}
          >
            {record.date
              ? new Date(record.date).toLocaleString('de')
              : record.id}{' '}
            · {record.invalid || 'Sicherung prüfen'}
          </button>
        ))}
      </div>
      {records.length > limit && (
        <button disabled={busy} onClick={() => setLimit(limit + 20)}>
          Weitere Sicherungen anzeigen
        </button>
      )}
      {allowRestore && (
        <label>
          <span>Oder eine heruntergeladene Feder-JSON-Sicherung prüfen</span>
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setPreview(null);
              setBusy(true);
              try {
                const library = validateLibrary(JSON.parse(await file.text()));
                setPreview({ library, label: file.name });
                setMessage('Feder-Sicherung vollständig geprüft.');
              } catch (error) {
                setMessage(
                  'Sicherung nicht verwendbar: ' + (error as Error).message,
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {preview && (
        <div>
          <h3>Geprüfter Stand: {preview.label}</h3>
          <p>
            {preview.library.projects.length} Projekte ·{' '}
            {preview.library.projects.reduce((n, p) => n + p.scenes.length, 0)}{' '}
            Texte/Szenen · {preview.library.snapshots.length} Versionen ·{' '}
            {imageInventory(preview.library).unique} eingebettete Bilder
          </p>
          <ul>
            {preview.library.projects.map((p) => (
              <li key={p.id}>{p.title || 'Ohne Titel'}</li>
            ))}
          </ul>
          <button
            disabled={busy}
            onClick={() =>
              download(
                JSON.stringify(preview.library, null, 2),
                'Feder-Gepruefte-Sicherung.json',
              )
            }
          >
            Geprüfte Sicherung herunterladen
          </button>
          {allowRestore ? (
            <>
              <p>
                Beim Wiederherstellen werden der geprüfte Stand und die
                bisherigen Originaldaten zuerst heruntergeladen. Zusätzlich
                bleiben die bisherigen Daten als lokale Rohdatensicherung
                erhalten. Anschließend wird dieser Stand auf diesem Gerät
                geöffnet.
              </p>
              <button disabled={busy} onClick={restore}>
                Diesen geprüften Stand lokal wiederherstellen
              </button>
            </>
          ) : (
            <p>
              Die heruntergeladene Datei kannst du unter „Projekte & Export“
              importieren. Deine bestehenden Projekte bleiben dabei erhalten.
            </p>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              try {
                download(
                  await backupBundle(preview.library),
                  'Feder-Gepruefte-Sicherung-mit-Bildern.zip',
                  'application/zip',
                );
              } catch (error) {
                setMessage((error as Error).message);
              }
            }}
          >
            Geprüfte Sicherung mit Bilddateien als ZIP herunterladen
          </button>
        </div>
      )}
      <output aria-live="polite">{message}</output>
      <TransferStatus progress={transfer} busy={busy} />
    </section>
  );
}
