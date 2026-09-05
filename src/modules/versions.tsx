import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { withSnapshot, restoreSnapshot } from '../core/history';
import { words, type Library, type Project } from '../core/model';
export function Versions({
  library,
  setLibrary,
  project,
  select,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  project: Project;
  select: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState('');
  const versions = library.snapshots.filter((v) => v.project.id === project.id);
  const selected = versions.find((v) => v.id === preview);
  const scene =
    selected?.project.scenes.find((s) => s.id === sceneId) ||
    selected?.project.scenes[0];
  const current = project.scenes.find((s) => s.id === scene?.id);
  return (
    <section className="version-panel">
      <h2>Versionen & Überarbeitungen</h2>
      <p className="muted small">
        Beim Wechsel zu „Überarbeitung“ wird der Ausgangsstand gesichert.
        Während der Überarbeitung entstehen vor weiteren Änderungen frühestens
        alle 10 Minuten zusätzliche Stände. Bestehende Versionen werden nicht
        automatisch gelöscht.
      </p>
      <form
        className="version-name"
        onSubmit={(e) => {
          e.preventDefault();
          setLibrary((l) =>
            withSnapshot(
              l,
              l.projects.find((p) => p.id === project.id)!,
              name,
            ),
          );
          setName('');
        }}
      >
        <input
          aria-label="Versionsname"
          placeholder="z. B. Erste Überarbeitung"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary-button" type="submit">
          Version sichern
        </button>
      </form>
      <div className="versions">
        {versions.map((v, i) => (
          <button
            key={v.id}
            onClick={() => {
              setPreview(v.id);
              setSceneId(v.project.scenes[0].id);
            }}
          >
            <span>
              <strong>
                V{v.number || versions.length - i} ·{' '}
                {v.label || 'Gesicherter Stand'}
              </strong>
              <small>
                {new Date(v.date).toLocaleString('de')} ·{' '}
                {v.reason === 'revision' ? 'Automatisch' : 'Gesichert'} ·{' '}
                {v.project.scenes.reduce((n, s) => n + words(s.text), 0)} Wörter
              </small>
            </span>
            <span>Ansehen</span>
          </button>
        ))}
      </div>
      {!versions.length && (
        <p className="muted small">Noch keine Version für dieses Buch.</p>
      )}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="version-dialog">
          <DialogTitle>{selected?.label || 'Version ansehen'}</DialogTitle>
          <DialogDescription>
            Vergleiche die Texte. Wiederherstellen setzt das gesamte Buch auf
            diesen Stand zurück und sichert vorher den aktuellen Stand als
            eigene Version.
          </DialogDescription>
          <div className="version-scene-buttons">
            {selected?.project.scenes.map((s) => (
              <button
                key={s.id}
                onClick={() => setSceneId(s.id)}
                aria-pressed={scene?.id === s.id}
              >
                {s.title}
              </button>
            ))}
          </div>
          <div className="version-comparison">
            <section>
              <h3>Gesicherte Version · {scene?.title}</h3>
              <pre>{scene?.text || '(Leer)'}</pre>
            </section>
            <section>
              <h3>Aktueller Stand</h3>
              <pre>
                {current?.text || '(Text leer oder nicht mehr vorhanden)'}
              </pre>
            </section>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              if (!selected) return;
              setLibrary((l) => restoreSnapshot(l, selected.id));
              select(selected.project.scenes[0].id);
              setPreview(null);
            }}
          >
            Gesamtes Buch wiederherstellen
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
