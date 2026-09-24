import { isStandalone, usesScenes } from '../core/project-format';
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  findMatches,
  replaceMatches,
  textDiff,
  addComment,
  type Match,
} from '../core/text-tools';
import type { Library, Project, Scene } from '../core/model';
export function DiffView({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => textDiff(before, after), [before, after]);
  return (
    <div className="text-diff">
      <p className="muted small">
        Gestrichen: entfernt · Unterstrichen: ergänzt. Sehr umfangreiche
        Änderungen werden als zusammenhängende Abschnitte markiert.
      </p>
      <div className="diff-content">
        {parts.map((p, i) =>
          p.type === 'add' ? (
            <ins key={i}>{p.text}</ins>
          ) : p.type === 'remove' ? (
            <del key={i}>{p.text}</del>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </div>
      {before === after && <p>Keine Textänderungen.</p>}
    </div>
  );
}
export function SearchReplace({
  open,
  setOpen,
  project,
  setLibrary,
  disabled,
  jump,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  project: Project;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  disabled: boolean;
  jump: (sceneId: string, start: number, end: number) => void;
}) {
  const [query, setQuery] = useState(''),
    [replacement, setReplacement] = useState(''),
    [matchCase, setMatchCase] = useState(false),
    [whole, setWhole] = useState(false);
  const [preview, setPreview] = useState<{
    project: Project;
    matches: Match[];
    replacement: string;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState('');
  const stale = preview?.project !== project;
  const invalidate = () => {
    setPreview(null);
    setMessage('');
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="review-dialog">
        <DialogTitle>Suchen & Ersetzen</DialogTitle>
        <DialogDescription>
          Durchsucht den Manuskripttext des aktuellen Projekts. Ersetze
          ausgewählte Treffer nach Prüfung der Vorschau; vorher wird eine
          Version gesichert.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const matches = findMatches(project, query, matchCase, whole);
            setPage(0);
            setPreview({ project, matches, replacement });
            setSelected(matches.map((m) => m.id));
            setMessage('');
          }}
        >
          <div className="review-fields">
            <label>
              Suchen
              <input
                required
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  invalidate();
                }}
              />
            </label>
            <label>
              Ersetzen durch
              <input
                value={replacement}
                onChange={(e) => {
                  setReplacement(e.target.value);
                  invalidate();
                }}
                placeholder="Leer lassen zum Entfernen"
              />
            </label>
          </div>
          <div className="review-options">
            <label>
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => {
                  setMatchCase(e.target.checked);
                  invalidate();
                }}
              />
              Groß-/Kleinschreibung
            </label>
            <label>
              <input
                type="checkbox"
                checked={whole}
                onChange={(e) => {
                  setWhole(e.target.checked);
                  invalidate();
                }}
              />
              Ganze Wörter
            </label>
          </div>
          <button className="primary-button" disabled={!query}>
            Vorschau erstellen
          </button>
        </form>
        {preview && (
          <>
            <p>
              {preview.matches.length} Treffer
              {preview.matches.length === 2000
                ? ' (höchstens 2.000 pro Durchlauf)'
                : ''}{' '}
              · {selected.length} ausgewählt
            </p>
            {stale && (
              <p role="alert">
                Der Text hat sich geändert. Bitte Vorschau neu erstellen.
              </p>
            )}
            <label>
              <input
                type="checkbox"
                checked={
                  !!preview.matches.length &&
                  selected.length === preview.matches.length
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? preview.matches.map((m) => m.id) : [],
                  )
                }
              />
              Alle Treffer auswählen (auch auf anderen Seiten)
            </label>
            <div className="review-results">
              {preview.matches.slice(page * 50, page * 50 + 50).map((m) => (
                <div className="replace-hit" key={m.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, m.id]
                            : ids.filter((id) => id !== m.id),
                        )
                      }
                    />
                    <strong>
                      {isStandalone(project)
                        ? usesScenes(project)
                          ? project.scenes.find((s) => s.id === m.sceneId)
                              ?.title
                          : project.title
                        : project.scenes
                            .filter((s) => s.id === m.sceneId)
                            .map((s) => `${s.chapter} · ${s.title}`)
                            .join('')}
                    </strong>
                  </label>
                  <p>{m.context}</p>
                  <p>
                    <del>{m.before}</del> →{' '}
                    <ins>{preview.replacement || '(entfernen)'}</ins>
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      jump(m.sceneId, m.start, m.end);
                      setOpen(false);
                    }}
                  >
                    Textstelle öffnen
                  </button>
                </div>
              ))}
            </div>
            {preview.matches.length > 50 && (
              <div className="review-options">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Vorherige Treffer
                </button>
                <span>
                  Seite {page + 1} von {Math.ceil(preview.matches.length / 50)}
                </span>
                <button
                  disabled={(page + 1) * 50 >= preview.matches.length}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Weitere Treffer
                </button>
              </div>
            )}
            <button
              className="primary-button"
              disabled={disabled || stale || !selected.length}
              onClick={() => {
                if (stale) return;
                setLibrary((l) =>
                  replaceMatches(
                    l,
                    project.id,
                    preview.matches.filter((m) => selected.includes(m.id)),
                    preview.replacement,
                  ),
                );
                setPreview(null);
                setMessage(
                  'Ausgewählte Treffer ersetzt. Der vorherige Stand ist in den Versionen gesichert.',
                );
              }}
            >
              Ausgewählte Treffer ersetzen
            </button>
          </>
        )}
        {message && <output>{message}</output>}
      </DialogContent>
    </Dialog>
  );
}
export function CommentsDialog({
  open,
  setOpen,
  scene,
  title,
  selection,
  patch,
  jump,
  disabled,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  scene: Scene;
  title: string;
  selection: { start: number; end: number };
  patch: (p: Partial<Scene>) => void;
  jump: (start: number, end: number) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(''),
    [showDone, setShowDone] = useState(false),
    [message, setMessage] = useState('');
  const quote = scene.text.slice(selection.start, selection.end);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="review-dialog">
        <DialogTitle>Kommentare · {title}</DialogTitle>
        <DialogDescription>
          Markiere im Manuskript eine Textstelle und füge hier einen Kommentar
          hinzu. Kommentare werden nicht mit dem Manuskript exportiert.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              patch({
                comments: addComment(
                  scene,
                  selection.start,
                  selection.end,
                  text,
                ).comments,
              });
              setText('');
              setMessage('Kommentar hinzugefügt.');
            } catch (e) {
              setMessage(String(e));
            }
          }}
        >
          <blockquote>
            {quote || 'Zuerst eine Textstelle im Manuskript markieren.'}
          </blockquote>
          <label className="field-label">
            KOMMENTAR
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
          </label>
          <button
            className="primary-button"
            disabled={disabled || !quote || !text.trim()}
          >
            Kommentar hinzufügen
          </button>
        </form>
        <label>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Erledigte Kommentare anzeigen
        </label>
        <div className="review-results">
          {(scene.comments || [])
            .filter((c) => showDone || !c.resolved)
            .map((c) => (
              <section className="comment-card" key={c.id}>
                <blockquote>{c.quote}</blockquote>
                {c.orphaned ? (
                  <p className="muted small">
                    Textstelle verändert oder entfernt – ursprüngliches Zitat
                    bleibt erhalten.
                  </p>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => {
                      jump(c.start, c.end);
                      setOpen(false);
                    }}
                  >
                    Zur Textstelle
                  </button>
                )}
                <label className="field-label">
                  NOTIZ
                  <textarea
                    disabled={disabled}
                    aria-label="Kommentar bearbeiten"
                    value={c.text}
                    onChange={(e) =>
                      patch({
                        comments: scene.comments?.map((x) =>
                          x.id === c.id ? { ...x, text: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={c.resolved}
                    onChange={(e) =>
                      patch({
                        comments: scene.comments?.map((x) =>
                          x.id === c.id
                            ? { ...x, resolved: e.target.checked }
                            : x,
                        ),
                      })
                    }
                  />
                  Erledigt
                </label>
              </section>
            ))}
        </div>
        {!scene.comments?.length && (
          <p>Noch keine Kommentare in diesem Text.</p>
        )}
        {message && <output>{message}</output>}
      </DialogContent>
    </Dialog>
  );
}
