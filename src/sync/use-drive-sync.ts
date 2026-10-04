import { useState, useRef, useEffect, useCallback } from 'react';
import { validateLibrary, type Library } from '../core/model';
import { save, readSyncCheckpoint, download } from '../core/storage';
import { Drive, remoteHeads, activeRecords } from './drive';
import { authorize, loadGoogle } from './google';
import { mergeLibraries, syncEqual } from './merge';
import { GOOGLE_CLIENT_ID } from './config';
import { verifyRemoteBackup } from './recovery';
import { replaceFromLocal } from './replace';
import type { TransferProgress } from './transfer-progress';
import { backupBundle } from '../core/backup-bundle';
import { imageInventory } from '../core/image-inventory';
import {
  readDrivePreview,
  restoreFromDrive,
  preserveRestoreEdits,
  repairIds,
  unseenRepairs,
  type DrivePreview,
} from './restore-from-drive';
export type RepairResult =
  | { ok: true; date: string; projects: number; images: number }
  | { ok: false; message: string };
function preference(key: string, fallback = '') {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export function useDriveSync(
  library: Library,
  setLibrary: React.Dispatch<React.SetStateAction<Library>>,
  saveError: string | null,
  flushLocalSaves: () => void = () => {},
) {
  const [clientId, setClient] = useState(
    () => GOOGLE_CLIENT_ID || preference('feder.sync.client'),
  );
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [connecting, setConnecting] = useState(false),
    [message, setMessage] = useState(''),
    [account, setAccount] = useState('');
  const [automatic, setAutomatic] = useState(
    () => preference('feder.sync.auto') === 'true',
  );
  const [authorizationPaused, setAuthorizationPaused] = useState(false);
  const [renewingAccess, setRenewingAccess] = useState(false);
  const authorizationWaiter = useRef<{
    key: string;
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairNoticeOpen, setRepairNoticeOpen] = useState(false);
  const [transfer, setTransfer] = useState<TransferProgress | null>(null);
  const [replacementReady, setReplacementReady] = useState<Library | null>(
    null,
  );
  const replacement = useRef<Library | null>(null);
  const [restoreReady, setRestoreReady] = useState<{
    preview: DrivePreview;
    local: Library;
    key: string;
  } | null>(null);
  const [syncedLibrary, setSyncedLibrary] = useState<Library | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [expires, setExpires] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const onlineChanged = () => setOnline(navigator.onLine);
    window.addEventListener('online', onlineChanged);
    window.addEventListener('offline', onlineChanged);
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onlineChanged);
      window.removeEventListener('offline', onlineChanged);
    };
  }, []);
  const [attention, setAttention] = useState(false);
  const [initial, setInitial] = useState<{
      projects: number;
      repaired?: boolean;
    } | null>(null),
    [lastSync, setLastSync] = useState('');
  const session = useRef<{
      token: string;
      expires: number;
      key: string;
    } | null>(null),
    running = useRef(false);
  const lastInteraction = useRef(0);
  const latest = useRef(library);
  useEffect(() => {
    latest.current = library;
  }, [library]);
  function configure(value: string) {
    if (running.current) return;
    setClient(value);
    session.current = null;
    setRestoreReady(null);
    setAccount('');
    setSyncedLibrary(null);
    setExpires(0);
    setInitial(null);
    try {
      localStorage.setItem('feder.sync.client', value);
    } catch {
      /* device setting */
    }
  }
  async function prepare() {
    try {
      await loadGoogle();
      setReady(true);
      setMessage('Google-Anmeldung bereit.');
    } catch (e) {
      setAttention(true);
      setMessage((e as Error).message);
    }
  }
  async function connect() {
    if (running.current) return;
    running.current = true;
    setConnecting(true);
    setMessage('Google-Anmeldung läuft …');
    try {
      const auth = await authorize(clientId.trim());
      const user = await new Drive(auth.token).account();
      session.current = {
        ...auth,
        key: 'sync:' + clientId.trim() + ':' + user.permissionId,
      };
      setRestoreReady(null);
      setExpires(auth.expires);
      setSyncedLibrary(null);
      setLastSync('');
      setAccount(user.emailAddress || user.displayName);
      setMessage(
        'Verbunden. Jetzt synchronisieren, um die Bibliotheken abzugleichen.',
      );
      setInitial(null);
    } catch (e) {
      setAttention(true);
      setMessage((e as Error).message);
    } finally {
      running.current = false;
      setConnecting(false);
    }
  }
  const pauseForAuthorization = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        const auth = session.current;
        if (!auth) {
          reject(Error('Die Google-Verbindung fehlt.'));
          return;
        }
        authorizationWaiter.current = { key: auth.key, resolve, reject };
        setAuthorizationPaused(true);
        setExpires(0);
        setMessage(
          'Google-Zugang abgelaufen. Die Übertragung ist pausiert. Bereits bestätigte Daten bleiben erhalten. Bitte den Zugang erneuern und hier fortsetzen; Feder nicht schließen.',
        );
      }),
    [],
  );
  async function renewTransferAccess() {
    const waiter = authorizationWaiter.current;
    if (!waiter || renewingAccess) return;
    setRenewingAccess(true);
    try {
      // Called by a button so Google's popup has a genuine user gesture.
      const auth = await authorize(clientId.trim());
      const user = await new Drive(auth.token).account();
      const key = 'sync:' + clientId.trim() + ':' + user.permissionId;
      if (key !== waiter.key)
        throw Error(
          'Bitte dasselbe Google-Konto wie zu Beginn der Übertragung wählen. Mit einem anderen Konto wird nicht fortgesetzt.',
        );
      if (authorizationWaiter.current !== waiter) return;
      session.current = { ...auth, key };
      setExpires(auth.expires);
      authorizationWaiter.current = null;
      setAuthorizationPaused(false);
      setMessage(
        'Google-Zugang erneuert. Übertragung wird an der bisherigen Stelle fortgesetzt …',
      );
      waiter.resolve(auth.token);
    } catch (error) {
      setMessage(
        (error as Error).message +
          ' Die Übertragung bleibt pausiert. Du kannst die Anmeldung erneut versuchen.',
      );
    } finally {
      setRenewingAccess(false);
    }
  }
  function cancelAuthorizationPause() {
    const waiter = authorizationWaiter.current;
    authorizationWaiter.current = null;
    setAuthorizationPaused(false);
    waiter?.reject(
      Error(
        'Übertragung auf deinen Wunsch angehalten. Es gibt keine Erfolgsbestätigung. Lokale Daten und bestätigte Drive-Blöcke bleiben erhalten.',
      ),
    );
  }
  const auto = useCallback((value: boolean) => {
    setAutomatic(value);
    try {
      localStorage.setItem('feder.sync.auto', String(value));
    } catch {
      /* device setting */
    }
  }, []);
  async function prepareReplacement() {
    if (running.current || saveError) return;
    running.current = true;
    setBusy(true);
    setTransfer(null);
    setMessage('Komplette Sicherung mit Bilddateien vorbereiten …');
    replacement.current = null;
    setReplacementReady(null);
    setRepairResult(null);
    setRepairNoticeOpen(false);
    try {
      const local = latest.current;
      const checked = validateLibrary(local);
      auto(false);
      const bundle = await backupBundle(checked);
      if (latest.current !== local)
        throw Error(
          'Die Bibliothek wurde geändert. Bitte die Sicherung erneut herunterladen.',
        );
      download(bundle, 'Feder-vor-Drive-Reparatur.zip', 'application/zip');
      replacement.current = local;
      setReplacementReady(local);
      setMessage(
        'Lokale Sicherung zum Download bereitgestellt. Prüfe die Datei und schließe Feder auf allen anderen Geräten, bevor du diesen Stand als Drive-Sicherung übernimmst.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function prepareRestore() {
    const auth = session.current;
    if (running.current || saveError) return;
    auto(false);
    setRestoreReady(null);
    if (!auth || auth.expires < Date.now() + 10000) {
      setMessage('Bitte die Google-Anmeldung erneuern.');
      return;
    }
    running.current = true;
    setBusy(true);
    setTransfer(null);
    setMessage(
      'Drive-Sicherung vollständig prüfen. Der lokale Stand bleibt bis zur Bestätigung erhalten …',
    );
    try {
      const local = latest.current;
      flushLocalSaves();
      await save(local);
      const preview = await readDrivePreview(
        new Drive(
          auth.token,
          setMessage,
          undefined,
          setTransfer,
          pauseForAuthorization,
        ),
      );
      const bundle = await backupBundle(local);
      if (latest.current !== local)
        throw Error('Lokale Änderungen. Bitte die Prüfung erneut starten.');
      download(bundle, 'Feder-vor-Drive-Uebernahme.zip', 'application/zip');
      setRestoreReady({ preview, local, key: auth.key });
      setMessage(
        'Drive-Sicherung geprüft, aber noch nicht übernommen. Prüfe die Projektliste unten und speichere die ZIP des bisherigen lokalen Stands. Danach die Übernahme ausdrücklich bestätigen.',
      );
    } catch (error) {
      setAttention(true);
      setMessage((error as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function confirmRestore() {
    const auth = session.current,
      prepared = restoreReady;
    if (running.current || saveError || !prepared) return;
    if (
      !auth ||
      auth.key !== prepared.key ||
      auth.expires < Date.now() + 10000
    ) {
      setMessage('Bitte erneut anmelden und die Drive-Sicherung prüfen.');
      return;
    }
    running.current = true;
    setBusy(true);
    setTransfer(null);
    setMessage('Geprüfte Drive-Bibliothek auf dieses Gerät übernehmen …');
    try {
      const unchanged = () => {
        if (latest.current !== prepared.local)
          throw Error(
            'Die lokale Bibliothek wurde geändert. Bitte erneut prüfen.',
          );
      };
      flushLocalSaves();
      const restored = await restoreFromDrive(
        new Drive(
          auth.token,
          setMessage,
          undefined,
          setTransfer,
          pauseForAuthorization,
        ),
        prepared.preview,
        prepared.local,
        auth.key,
        save,
        unchanged,
      );
      setLibrary((current) =>
        preserveRestoreEdits(prepared.local, current, restored.library),
      );
      setSyncedLibrary(restored.library);
      setLastSync(restored.date);
      setInitial(null);
      setRestoreReady(null);
      setAttention(false);
      setMessage(
        `Drive-Bibliothek erfolgreich auf diesem Gerät übernommen: ${restored.library.projects.length} Projekte. Cover, Figurenbilder und Versionen sind enthalten. Der vorherige lokale Stand ist gesichert. Es wurde nichts nach Drive hochgeladen. Die Automatik bleibt ausgeschaltet.`,
      );
    } catch (error) {
      setAttention(true);
      setMessage((error as Error).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const synchronize = useCallback(
    async (mode: 'merge' | 'automatic' | 'replace' = 'merge') => {
      const auth = session.current;
      if (running.current) return;
      if (saveError) {
        setMessage(
          'Lokales Speichern ist angehalten. Bitte zuerst den Speicherfehler beheben.',
        );
        return;
      }
      if (!auth || auth.expires < Date.now() + 10000) {
        setAttention(true);
        setMessage(
          'Bitte die Google-Anmeldung erneuern. Lokal kannst du weiterarbeiten.',
        );
        return;
      }
      if (!navigator.onLine) {
        setMessage(
          'Offline: Änderungen bleiben lokal. Später erneut synchronisieren.',
        );
        return;
      }
      running.current = true;
      setBusy(true);
      setTransfer(null);
      setMessage('Bibliotheken werden abgeglichen …');
      if (mode === 'replace') {
        setRepairResult(null);
        setRepairNoticeOpen(false);
      }
      try {
        const local = latest.current;
        flushLocalSaves();
        await save(local);
        const drive = new Drive(
          auth.token,
          setMessage,
          undefined,
          setTransfer,
          pauseForAuthorization,
        );
        if (mode === 'replace') {
          if (replacement.current !== local)
            throw Error(
              'Die lokale Bibliothek wurde seit der Sicherung geändert. Bitte zuerst erneut die komplette Sicherung herunterladen.',
            );
          const unchanged = () => {
            if (latest.current !== local)
              throw Error(
                'Lokale Änderungen während der Sicherung. Es wird kein veralteter Stand als vollständig abgeglichen bestätigt. Bitte erneut versuchen.',
              );
          };
          unchanged();
          const record = await replaceFromLocal(drive, local, unchanged);
          unchanged();
          const date = record.date;
          await save(local, {
            key: auth.key,
            checkpoint: { base: local, date, repairs: [record.id] },
          });
          setRepairResult({
            ok: true,
            date,
            projects: local.projects.length,
            images: imageInventory(local).unique,
          });
          setRepairNoticeOpen(true);
          setSyncedLibrary(local);
          setLastSync(date);
          setAttention(false);
          setInitial(null);
          setReplacementReady(null);
          replacement.current = null;
          setMessage(
            'Dieser lokale Stand ist vollständig aus Drive zurückgelesen und geprüft worden und gilt jetzt als maßgebliche Sicherung. Deine lokale Bibliothek bleibt erhalten. Ältere Drive-Stände bleiben im Rettungsbereich verfügbar.',
          );
          return;
        }
        const raw = (await readSyncCheckpoint(auth.key)) as
          | { base?: unknown; date?: string }
          | undefined;
        const base = raw?.base ? validateLibrary(raw.base) : null;
        const observed = await drive.list({ recovery: true });
        const records = activeRecords(observed),
          heads = remoteHeads(records);
        if (heads.length > 20)
          throw Error(
            'Sehr viele parallele Syncstände. Bitte zuerst die Drive-Daten sichern und prüfen.',
          );
        const unacknowledgedRepair = unseenRepairs(observed, raw).length > 0;
        let remote: Library | null = null;
        const conflicts: string[] = [];
        for (const head of heads) {
          const contents = await drive.read(head, {
            cache: !unacknowledgedRepair,
          });
          if (!remote) remote = contents;
          else {
            const merged = mergeLibraries(null, remote, contents);
            remote = merged.library;
            conflicts.push(...merged.conflicts);
          }
        }
        if (remote && unacknowledgedRepair) {
          auto(false);
          setAttention(true);
          setInitial({ projects: remote.projects.length, repaired: true });
          setMessage(
            'Drive enthält eine ausdrücklich reparierte Bibliothek. Dieser alte Gerätestand darf sie nicht automatisch verändern. Bitte „Drive-Stand prüfen und auf dieses Gerät übernehmen“ wählen. Es wurde nichts hochgeladen.',
          );
          return;
        }
        // First contact always asks before bringing another device's library into the workspace.
        if (remote && !base && !initial) {
          setAttention(true);
          setInitial({ projects: remote.projects.length });
          setMessage(
            'Drive wurde gelesen, aber noch nicht übernommen. Bitte unten auswählen: Drive-Stand prüfen und übernehmen oder beide Bibliotheken zusammenführen.',
          );
          return;
        }
        if (mode === 'automatic' && !base) {
          setMessage('Bitte die erste Synchronisierung manuell starten.');
          return;
        }
        let result = local;
        if (remote) {
          const merged = mergeLibraries(base, local, remote);
          result = merged.library;
          conflicts.push(...merged.conflicts);
        }
        const unchanged = () => {
          if (latest.current !== local)
            throw Error(
              'Lokale Änderungen während des Abgleichs. Bitte erneut synchronisieren; deine Änderungen bleiben erhalten.',
            );
        };
        unchanged();
        const uploaded =
          !remote ||
          heads.length !== 1 ||
          heads.some((h) => h.protocol !== 2) ||
          !syncEqual(result, remote)
            ? await drive.create(
                result,
                heads.map((h) => h.id),
              )
            : undefined;
        unchanged();
        if (uploaded) {
          setMessage(
            'Drive-Sicherung vollständig auf Wiederherstellbarkeit prüfen …',
          );
          await verifyRemoteBackup(
            drive,
            {
              id: uploaded,
              parents: heads.map((h) => h.id),
              protocol: 2,
              date: new Date().toISOString(),
            },
            result,
          );
          unchanged();
        }
        const date = new Date().toISOString();
        setMessage('Abgeglichenen Stand lokal sichern …');
        flushLocalSaves();
        await save(result, {
          key: auth.key,
          checkpoint: { base: result, date, repairs: repairIds(observed) },
          previous: syncEqual(result, local) ? undefined : local,
        });
        // Preserve edits completing asynchronously while the IndexedDB transaction commits.
        setLibrary((current) =>
          current === local
            ? result
            : mergeLibraries(local, current, result).library,
        );
        setInitial(null);
        setLastSync(date);
        setSyncedLibrary(result);
        setMessage('Sync abschließen …');
        let cleanupFailed = false;
        // Keep immutable manifests as recoverable history. Delete observed
        // older manifests only for an explicit permanent project purge.
        {
          const permanentPurge = (result.purgedProjectIds || []).some(
            (id) => !(base?.purgedProjectIds || []).includes(id),
          );
          for (const record of observed.filter(
            () => permanentPurge && !!uploaded,
          )) {
            try {
              await drive.remove(record.id);
            } catch {
              cleanupFailed = true;
              break;
            }
          }
        }
        setAttention(conflicts.length > 0 || cleanupFailed);
        setMessage(
          (conflicts.length
            ? `Synchronisiert. ${conflicts.length} Konflikt(e): Beide Bearbeitungen bleiben erhalten; prüfe die Konfliktkopien bzw. beibehaltenen Projekte.`
            : 'Synchronisiert – alle Projekte, Cover, Versionen, Kommentare und Romanwelten sind abgeglichen.') +
            (cleanupFailed
              ? ' Ältere Drive-Syncstände konnten noch nicht bereinigt werden.'
              : ''),
        );
      } catch (e) {
        if (mode === 'replace') {
          setRepairResult({ ok: false, message: (e as Error).message });
          setRepairNoticeOpen(true);
        }
        setAttention(true);
        setMessage((e as Error).message);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [
      saveError,
      setLibrary,
      initial,
      flushLocalSaves,
      auto,
      pauseForAuthorization,
    ],
  );
  useEffect(() => {
    if (!automatic || !account) return;
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !document.querySelector('[role="dialog"]') &&
        Date.now() - lastInteraction.current > 15000
      )
        void synchronize('automatic');
    }, 60000);
    return () => clearInterval(timer);
  }, [automatic, account, synchronize]);
  useEffect(() => {
    const touched = () => {
      lastInteraction.current = Date.now();
    };
    window.addEventListener('keydown', touched);
    window.addEventListener('pointerdown', touched);
    return () => {
      window.removeEventListener('keydown', touched);
      window.removeEventListener('pointerdown', touched);
    };
  }, []);
  function disconnect() {
    if (running.current) return;
    session.current = null;
    setRestoreReady(null);
    setAccount('');
    setSyncedLibrary(null);
    setExpires(0);
    setInitial(null);
    setMessage(
      'Verbindung auf diesem Gerät getrennt. Lokale Daten und Drive-Daten bleiben erhalten.',
    );
  }
  const status:
    | 'offline'
    | 'synced'
    | 'busy'
    | 'auth'
    | 'attention'
    | 'pending' = !online
    ? 'offline'
    : busy
      ? 'busy'
      : !account || expires < clock + 10000
        ? 'auth'
        : attention || initial
          ? 'attention'
          : syncedLibrary &&
              (Object.keys(library) as (keyof Library)[]).every(
                (key) =>
                  key === 'active' || library[key] === syncedLibrary[key],
              )
            ? 'synced'
            : 'pending';
  return {
    status,
    clientId,
    attention,
    configure,
    ready,
    prepare,
    connect,
    busy,
    connecting,
    message,
    account,
    automatic,
    transfer,
    authorizationPaused,
    renewingAccess,
    renewTransferAccess,
    cancelAuthorizationPause,
    repairResult,
    repairNoticeOpen,
    dismissRepairNotice: () => setRepairNoticeOpen(false),
    prepareReplacement,
    prepareRestore,
    confirmRestore,
    restoreReady: restoreReady?.local === library ? restoreReady.preview : null,
    replacementReady: replacementReady === library ? replacementReady : null,
    auto,
    initial,
    lastSync,
    synchronize,
    disconnect,
    configured: !!GOOGLE_CLIENT_ID,
  };
}
export type DriveSync = ReturnType<typeof useDriveSync>;
