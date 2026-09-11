import { useState } from 'react';
import releases from '../core/releases.json';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
const key = 'feder.release.seen';
export function WhatsNew() {
  const [seen] = useState(() => {
    try {
      return localStorage.getItem(key) || '0.9.2';
    } catch {
      return '0.9.2';
    }
  });
  const [open, setOpen] = useState(seen !== releases[0].version);
  const index = releases.findIndex((r) => r.version === seen);
  const news = releases.slice(0, index > 0 ? index : 1);
  const close = () => {
    try {
      localStorage.setItem(key, releases[0].version);
    } catch {
      /* optional */
    }
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="project-dialog whats-new">
        <DialogTitle>Was ist neu in Feder {releases[0].version}?</DialogTitle>
        <DialogDescription>
          Die Neuerungen auf einen Blick. Die vollständige Historie findest du
          jederzeit in den Einstellungen unter App & Daten.
        </DialogDescription>
        {news.map((r) => (
          <section key={r.version}>
            <h3>
              {r.version} · {r.title}
            </h3>
            <ul>
              {r.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        ))}
        <button className="primary-button" onClick={close}>
          Zum Schreibplatz
        </button>
      </DialogContent>
    </Dialog>
  );
}
