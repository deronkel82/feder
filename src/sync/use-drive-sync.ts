import { useState, useRef, useEffect, useCallback } from 'react';
import { validateLibrary, type Library } from '../core/model';
import { save, readSyncCheckpoint } from '../core/storage';
import { Drive, remoteHeads } from './drive';
import { authorize, loadGoogle } from './google';
import { mergeLibraries, syncEqual } from './merge';
import { GOOGLE_CLIENT_ID } from './config';
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
  const [initial, setInitial] = useState<{ projects: number } | null>(null),
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
  const synchronize = useCallback(
    async (mode: 'merge' | 'download' | 'automatic' = 'merge') => {
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
      setMessage('Bibliotheken werden abgeglichen …');
      try {
        const local = latest.current;
        const drive = new Drive(auth.token, setMessage);
        const raw = (await readSyncCheckpoint(auth.key)) as
          | { base?: unknown; date?: string }
          | undefined;
        const base = raw?.base ? validateLibrary(raw.base) : null;
        const records = await drive.list(),
          heads = remoteHeads(records);
        if (heads.length > 20)
          throw Error(
            'Sehr viele parallele Syncstände. Bitte zuerst die Drive-Daten sichern und prüfen.',
          );
        let remote: Library | null = null;
        const conflicts: string[] = [];
        for (const head of heads) {
          const contents = await drive.read(head);
          if (!remote) remote = contents;
          else {
            const merged = mergeLibraries(null, remote, contents);
            remote = merged.library;
            conflicts.push(...merged.conflicts);
          }
        }
        // First contact always asks before bringing another device's library into the workspace.
        if (remote && !base && !initial) {
          setAttention(true);
          setInitial({ projects: remote.projects.length });
          setMessage(
            'In Drive liegt bereits eine Bibliothek. Bitte unten auswählen, wie sie übernommen werden soll.',
          );
          return;
        }
        if (mode === 'automatic' && !base) {
          setMessage('Bitte die erste Synchronisierung manuell starten.');
          return;
        }
        let result = local;
        if (remote) {
          if (mode === 'download' && !base)
            result = {
              ...remote,
              active: remote.projects.some((p) => p.id === local.active)
                ? local.active
                : remote.active,
            };
          else {
            const merged = mergeLibraries(base, local, remote);
            result = merged.library;
            conflicts.push(...merged.conflicts);
          }
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
        const date = new Date().toISOString();
        setMessage('Abgeglichenen Stand lokal sichern …');
        await save(result, {
          key: auth.key,
          checkpoint: { base: result, date },
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
        // Only delete records observed before our immutable commit. A simultaneous writer's new record is never removed.
        {
          for (const record of records.filter(
            (r) => uploaded || !heads.some((h) => h.id === r.id),
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
        setAttention(true);
        setMessage((e as Error).message);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [saveError, setLibrary, initial],
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
  function auto(value: boolean) {
    setAutomatic(value);
    try {
      localStorage.setItem('feder.sync.auto', String(value));
    } catch {
      /* device setting */
    }
  }
  function disconnect() {
    if (running.current) return;
    session.current = null;
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
    auto,
    initial,
    lastSync,
    synchronize,
    disconnect,
    configured: !!GOOGLE_CLIENT_ID,
  };
}
export type DriveSync = ReturnType<typeof useDriveSync>;
