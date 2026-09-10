import { isStandalone } from '../core/project-format';
import { DiffView } from './text-review';
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
  const [compareId, setCompareId] = useState('current');
  const comparison =
    library.snapshots.find(
      (v) => v.id === compareId && v.project.id === project.id,
    )?.project || project;
  const versions = library.snapshots.filter((v) => v.project.id === project.id);
  const selected = versions.find((v) => v.id === preview);
  const sceneList = [
    ...new Map(
      [...(selected?.project.scenes || []), ...comparison.scenes].map((s) => [
        s.id,
        s,
      ]),
    ).values(),
  ];
  const activeScene = sceneId || sceneList[0]?.id;
  const scene = selected?.project.scenes.find((s) => s.id === activeScene);
  const current = comparison.scenes.find((s) => s.id === activeScene);
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
            eigene Version. Gemeinsame Romanwelten bleiben bei einer
            Projekt-Wiederherstellung unverändert.
          </DialogDescription>
          <label className="field-label">
            VERGLEICHEN MIT
            <select
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
            >
              <option value="current">Aktueller Stand</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} · {new Date(v.date).toLocaleString('de')}
                </option>
              ))}
            </select>
          </label>
          <div className="version-scene-buttons">
            {sceneList.map((s) => (
              <button
                key={s.id}
                onClick={() => setSceneId(s.id)}
                aria-pressed={activeScene === s.id}
              >
                {isStandalone(project)
                  ? project.title
                  : `${s.chapter} · ${s.title}`}
              </button>
            ))}
          </div>
          <h3>
            {scene?.title || current?.title}{' '}
            {!scene ? '· Neu hinzugefügt' : !current ? '· Entfernt' : ''}
          </h3>
          <DiffView before={scene?.text || ''} after={current?.text || ''} />
          <button
            className="primary-button"
            onClick={() => {
              if (!selected) return;
              setLibrary((l) => restoreSnapshot(l, selected.id));
              select(selected.project.scenes[0].id);
              setPreview(null);
            }}
          >
            Projekt auf diese Version zurücksetzen
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
