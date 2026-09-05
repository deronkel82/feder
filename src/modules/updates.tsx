import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover';
import { backupForUpdate } from '../core/storage';
import type { Library } from '../core/model';
export function useUpdates(library: Library, error: string | null) {
  const latest = useRef({ library, error });
  useEffect(() => {
    latest.current = { library, error };
  }, [library, error]);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reloadReady = useRef(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    let disposed = false;
    let detach = () => {};
    const changed = () => {
      if (reloadReady.current) location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    void navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then((r) => {
        if (disposed) return;
        registration.current = r;
        const refresh = () => setWaiting(r.waiting);
        const found = () => {
          r.installing?.addEventListener('statechange', refresh);
        };
        r.addEventListener('updatefound', found);
        refresh();
        const visible = () => {
          if (document.visibilityState === 'visible')
            void r.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', visible);
        detach = () => {
          r.removeEventListener('updatefound', found);
          document.removeEventListener('visibilitychange', visible);
        };
        void r.update().catch(() => {});
      })
      .catch(() => setMessage('Update-Prüfung derzeit nicht verfügbar.'));
    return () => {
      disposed = true;
      detach();
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
    };
  }, []);
  async function check() {
    if (!registration.current) {
      setMessage('Updates sind in der veröffentlichten App verfügbar.');
      return;
    }
    setMessage('Suche nach Updates …');
    try {
      await registration.current.update();
      setWaiting(registration.current.waiting);
      setMessage(
        registration.current.waiting
          ? 'Neue Version bereit.'
          : registration.current.installing
            ? 'Neue Version wird heruntergeladen …'
            : 'Die Update-Prüfung ist abgeschlossen.',
      );
    } catch {
      setMessage('Keine Verbindung. Deine Arbeit bleibt lokal verfügbar.');
    }
  }
  async function apply() {
    if (!waiting || busy) return;
    setBusy(true);
    setMessage('Arbeit und Update-Sicherung werden gespeichert …');
    try {
      if (latest.current.error)
        throw Error('Bitte behebe zuerst das Speicherproblem.');
      await backupForUpdate(latest.current.library);
      reloadReady.current = true;
      await new Promise<void>((resolve, reject) => {
        const ch = new MessageChannel();
        const timer = setTimeout(() => {
          ch.port1.close();
          reject(
            Error(
              'Update reagiert nicht. Bitte schließe weitere Feder-Fenster und versuche es erneut.',
            ),
          );
        }, 12000);
        ch.port1.onmessage = (e) => {
          clearTimeout(timer);
          ch.port1.close();
          if (e.data.ok) resolve();
          else reject(Error(e.data.error));
        };
        waiting.postMessage({ type: 'ACTIVATE_SAFELY' }, [ch.port2]);
      });
      setMessage('Update wird gestartet …');
      await new Promise<void>((resolve, reject) => {
        const state = () => {
          if (waiting.state === 'activated') {
            clearTimeout(timer);
            waiting.removeEventListener('statechange', state);
            resolve();
          }
        };
        const timer = setTimeout(() => {
          waiting.removeEventListener('statechange', state);
          reject(
            Error(
              'Aktivierung dauert länger. Bitte versuche das Update erneut.',
            ),
          );
        }, 12000);
        waiting.addEventListener('statechange', state);
        state();
      });
      location.reload();
    } catch (e) {
      reloadReady.current = false;
      setBusy(false);
      setMessage(e instanceof Error ? e.message : 'Update fehlgeschlagen.');
    }
  }
  return { waiting, busy, message, check, apply };
}
export function UpdateNotice({
  updates,
}: {
  updates: ReturnType<typeof useUpdates>;
}) {
  return (
    <>
      <Popover>
        <PopoverTrigger
          className="update-trigger"
          disabled={updates.busy}
          title={
            updates.waiting ? 'Neue Version verfügbar' : 'Version und Updates'
          }
          aria-label={
            updates.waiting
              ? 'Neue Version verfügbar – Updates öffnen'
              : 'Version und Updates öffnen'
          }
        >
          <RefreshCw size={17} />
          <span className="update-version">0.4.1</span>
          {updates.waiting && <span className="update-dot" />}
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="update-popover">
          <PopoverTitle>Feder 0.4.1</PopoverTitle>
          <PopoverDescription>
            {updates.waiting
              ? 'Eine neue Version steht bereit.'
              : 'Updates werden automatisch im Hintergrund gesucht.'}
          </PopoverDescription>
          <div className="update-controls">
            <button
              disabled={updates.busy}
              onClick={() => void updates.check()}
            >
              Updates prüfen
            </button>
            {updates.waiting && (
              <button
                className="primary-button"
                disabled={updates.busy}
                onClick={() => void updates.apply()}
              >
                Jetzt aktualisieren
              </button>
            )}
          </div>
          {updates.message && (
            <output className="update-message" aria-live="polite">
              {updates.message}
            </output>
          )}
        </PopoverContent>
      </Popover>
      {updates.busy &&
        createPortal(
          <div className="update-shield" role="alert">
            {updates.message}
            <p>Deine Arbeit wird geschützt. Bitte kurz warten.</p>
          </div>,
          document.body,
        )}
    </>
  );
}
