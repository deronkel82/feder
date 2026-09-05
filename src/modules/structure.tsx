import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Project } from '../core/model';
import type { StructureAction } from '../core/structure';
export type StructureSelection = {
  kind: 'scene' | 'chapter' | 'new';
  id: string;
};
export function StructureDialog({
  project,
  selection,
  close,
  apply,
}: {
  project: Project;
  selection: StructureSelection;
  close: () => void;
  apply: (a: StructureAction) => void;
}) {
  const scene =
    project.scenes.find((s) => s.id === selection.id) || project.scenes[0];
  const chapter = selection.kind === 'chapter' ? selection.id : scene.chapter;
  const [action, setAction] = useState(
    selection.kind === 'scene'
      ? 'move'
      : selection.kind === 'new'
        ? 'newChapter'
        : 'rename',
  );
  const [name, setName] = useState(selection.kind === 'chapter' ? chapter : '');
  const others = [...new Set(project.scenes.map((s) => s.chapter))].filter(
    (c) => c !== chapter,
  );
  const [target, setTarget] = useState(others[0] || '');
  const [error, setError] = useState('');
  const deleting = action === 'deleteScene' || action === 'deleteChapter';
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="structure-dialog">
        <DialogTitle>
          {selection.kind === 'scene'
            ? `Szene: ${scene.title}`
            : selection.kind === 'new'
              ? 'Neues Kapitel'
              : `Kapitel: ${chapter}`}
        </DialogTitle>
        <DialogDescription>
          Änderungen an der Struktur werden vorher als Version gesichert.
        </DialogDescription>
        <form
          className="structure-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              let a: StructureAction;
              if (action === 'move' || action === 'promote')
                a = {
                  type: action,
                  sceneId: scene.id,
                  chapter: action === 'move' ? target : name,
                };
              else if (action === 'rename')
                a = { type: 'rename', chapter, name };
              else if (action === 'collapse')
                a = { type: 'collapse', chapter, target };
              else if (action === 'deleteScene')
                a = { type: 'deleteScene', sceneId: scene.id };
              else if (action === 'deleteChapter')
                a = { type: 'deleteChapter', chapter };
              else a = { type: 'newChapter', chapter: name };
              apply(a);
              close();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'Änderung nicht möglich.',
              );
            }
          }}
        >
          <label className="field-label">
            AKTION
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setError('');
              }}
            >
              {selection.kind === 'scene' ? (
                <>
                  <option value="move">In anderes Kapitel verschieben</option>
                  <option value="promote">
                    Aus Szene neues Kapitel machen
                  </option>
                  <option value="deleteScene">Szene löschen</option>
                </>
              ) : selection.kind === 'new' ? (
                <option value="newChapter">
                  Kapitel mit leerer Szene anlegen
                </option>
              ) : (
                <>
                  <option value="rename">Kapitel umbenennen</option>
                  <option value="collapse">
                    Kapitel in eine Szene umwandeln
                  </option>
                  <option value="deleteChapter">
                    Kapitel mit allen Szenen löschen
                  </option>
                </>
              )}
            </select>
          </label>
          {(action === 'rename' ||
            action === 'promote' ||
            action === 'newChapter') && (
            <label className="field-label">
              KAPITELNAME
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name des Kapitels"
              />
            </label>
          )}
          {(action === 'move' || action === 'collapse') && (
            <label className="field-label">
              ZIELKAPITEL
              <select
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="" disabled>
                  Kapitel wählen
                </option>
                {others.map((c) => (
                  <option key={c} value={c}>
                    {c || '(Unbenannt)'}
                  </option>
                ))}
              </select>
              {!others.length && (
                <span className="muted small">
                  Lege zuerst ein weiteres Kapitel an.
                </span>
              )}
            </label>
          )}
          {action === 'promote' && (
            <p>
              Die Szene behält ihren Text und wird in ein eigenes neues Kapitel
              verschoben.
            </p>
          )}
          {action === 'collapse' && (
            <p>
              Die {project.scenes.filter((s) => s.chapter === chapter).length}{' '}
              Szenen dieses Kapitels werden in ihrer Reihenfolge zu einer Szene
              zusammengefügt und ans Ende des Zielkapitels verschoben. Die
              bisherigen Szenendetails bleiben in der Sicherung; bei mehreren
              Szenen werden sie zusätzlich in den Notizen gesammelt.
            </p>
          )}
          {deleting && (
            <p className="structure-warning">
              {action === 'deleteChapter'
                ? `Das gesamte Kapitel mit ${project.scenes.filter((s) => s.chapter === chapter).length} Szenen wird gelöscht.`
                : 'Diese Szene wird gelöscht.'}{' '}
              Über „Version sichern“ kannst du den vorherigen Buchstand
              wiederherstellen. Falls das Buch danach leer wäre, bleibt eine
              neue leere Szene.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={(action === 'move' || action === 'collapse') && !target}
            >
              {deleting ? 'Löschen und vorher sichern' : 'Änderung übernehmen'}
            </button>
            <button type="button" onClick={close}>
              Abbrechen
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
