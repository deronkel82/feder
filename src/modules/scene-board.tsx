import { useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { type Library, type Project, words } from '../core/model';
import { isStandalone, usesScenes } from '../core/project-format';
import { chapterLabel, chapterDetails } from '../core/chapters';
import { boardChapters, placeScene } from '../core/scene-board';
export function SceneBoard({
  project,
  library,
  setLibrary,
  disabled,
  jump,
}: {
  project: Project;
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  disabled: boolean;
  jump: (id: string, start: number, end: number) => void;
}) {
  const [selected, setSelected] = useState(''),
    [hover, setHover] = useState(''),
    [message, setMessage] = useState('');
  const [undo, setUndo] = useState<{ before: Project; after: Project } | null>(
    null,
  );
  const touch = useRef('');
  if (!usesScenes(project))
    return (
      <p>
        Diese Ansicht benötigt separate Szenen. Du kannst sie unter Projekte &
        Export einschalten.
      </p>
    );
  const move = (chapter: string, before?: string, id = selected) => {
    if (disabled || !id) return;
    try {
      const next = placeScene(library, project.id, id, chapter, before);
      if (next !== library) {
        setUndo({
          before: project,
          after: next.projects.find((p) => p.id === project.id)!,
        });
        setLibrary(next);
        setMessage(
          'Szene verschoben. Die vorige Anordnung ist als Version gesichert.',
        );
      }
      setSelected('');
      setHover('');
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const targetAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-scene-drop]');
  const slot = (chapter: string, before?: string) => {
    const key = JSON.stringify([chapter, before || '']);
    return (
      <button
        type="button"
        className={'scene-drop ' + (hover === key ? 'drop-active' : '')}
        key={key}
        data-scene-drop={key}
        disabled={disabled}
        aria-label={`${before ? 'Vor Szene einfügen' : isStandalone(project) ? 'Am Ende einfügen' : 'Am Kapitelende einfügen'}: ${isStandalone(project) ? project.title : chapterLabel(project, chapter)}`}
        onClick={() => move(chapter, before)}
        onDragOver={(e) => {
          if (selected && !disabled) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setHover(key);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          move(chapter, before);
        }}
      >
        {selected ? 'Hier einfügen' : '+'}
      </button>
    );
  };
  return (
    <section className="scene-board">
      <p>
        {isStandalone(project)
          ? 'Ordne die Szenen deiner Kurzgeschichte.'
          : 'Jede Zeile ist ein Kapitel. Leere Kapitel bleiben als Ziel erhalten.'}{' '}
        Ziehe Szenen am Griff auf eine Einfügestelle – oder wähle „Verschieben“
        und anschließend „Hier einfügen“.
      </p>
      <div className="review-options">
        {selected && (
          <button
            onClick={() => {
              setSelected('');
              setHover('');
            }}
          >
            Verschieben abbrechen
          </button>
        )}
        {undo && (
          <button
            disabled={disabled || project !== undo.after}
            onClick={() => {
              if (project !== undo.after) return;
              setLibrary((l) => ({
                ...l,
                projects: l.projects.map((p) =>
                  p === undo.after
                    ? {
                        ...p,
                        scenes: undo.before.scenes,
                        chapterMeta: undo.before.chapterMeta,
                        updated: new Date().toISOString(),
                      }
                    : p,
                ),
              }));
              setUndo(null);
              setMessage('Letzte Verschiebung rückgängig gemacht.');
            }}
          >
            Letzte Verschiebung rückgängig
          </button>
        )}
      </div>
      <output aria-live="polite">{message}</output>
      {boardChapters(project).map((chapter) => (
        <section className="scene-board-row" key={chapter}>
          <h3>
            {!isStandalone(project) &&
              chapterDetails(project, chapter).part && (
                <small>{chapterDetails(project, chapter).part} · </small>
              )}
            {isStandalone(project) ? 'Szenen' : chapterLabel(project, chapter)}
          </h3>
          <div className="scene-board-cards">
            {project.scenes
              .filter((s) => s.chapter === chapter)
              .map((s) => (
                <div className="scene-board-unit" key={s.id}>
                  {slot(chapter, s.id)}
                  <article
                    className={
                      'scene-board-card ' + (selected === s.id ? 'picked' : '')
                    }
                  >
                    <button
                      className="scene-drag-handle"
                      aria-label={`${s.title} ziehen`}
                      draggable={false}
                      disabled={disabled}
                      onPointerDown={(e) => {
                        if (disabled) return;
                        e.preventDefault();
                        touch.current = s.id;
                        setSelected(s.id);
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!touch.current) return;
                        const t = targetAt(e.clientX, e.clientY);
                        setHover(t?.dataset.sceneDrop || '');
                        const dialog = e.currentTarget.closest(
                          '[data-slot="dialog-content"]',
                        );
                        if (dialog) {
                          const r = dialog.getBoundingClientRect();
                          if (e.clientY < r.top + 55) dialog.scrollBy(0, -18);
                          if (e.clientY > r.bottom - 55) dialog.scrollBy(0, 18);
                        }
                        const row = document
                          .elementFromPoint(e.clientX, e.clientY)
                          ?.closest('.scene-board-cards');
                        if (row) {
                          const r = row.getBoundingClientRect();
                          if (e.clientX < r.left + 50) row.scrollBy(-18, 0);
                          if (e.clientX > r.right - 50) row.scrollBy(18, 0);
                        }
                      }}
                      onPointerUp={(e) => {
                        const id = touch.current;
                        if (!id) return;
                        touch.current = '';
                        const t = targetAt(e.clientX, e.clientY)?.dataset
                          .sceneDrop;
                        if (t) {
                          const [c, b] = JSON.parse(t) as string[];
                          move(c, b || undefined, id);
                        }
                        setHover('');
                      }}
                      onPointerCancel={() => {
                        touch.current = '';
                        setHover('');
                      }}
                    >
                      <GripVertical size={20} />
                    </button>
                    <button
                      className="scene-board-open"
                      onClick={() => jump(s.id, 0, 0)}
                    >
                      {s.title}
                    </button>
                    <small>
                      {s.status} · {words(s.text)} Wörter
                    </small>
                    <p>{s.synopsis || 'Noch keine Zusammenfassung'}</p>
                    <button
                      disabled={disabled}
                      aria-pressed={selected === s.id}
                      onClick={() => setSelected(s.id)}
                    >
                      Verschieben
                    </button>
                  </article>
                </div>
              ))}
            {slot(chapter)}
          </div>
        </section>
      ))}
    </section>
  );
}
