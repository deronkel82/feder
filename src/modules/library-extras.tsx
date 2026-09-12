import { CharacterFields } from './character-fields';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  purgeProject,
  saveTemplate,
  instantiateTemplate,
} from '../core/library-tools';
import { projectStatuses, projectStatus } from '../core/project-gallery';
import { uid, type Library, type Project, type Card } from '../core/model';
export function ProjectExtras({
  library,
  setLibrary,
  project,
  update,
  select,
  disabled,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  select: (id: string) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState(''),
    [title, setTitle] = useState(''),
    [message, setMessage] = useState('');
  return (
    <section className="project-extras">
      <label className="field-label">
        PROJEKTSTATUS
        <select
          value={project.manualStatus || 'auto'}
          disabled={disabled}
          onChange={(e) =>
            update((p) => ({
              ...p,
              manualStatus:
                e.target.value === 'auto'
                  ? undefined
                  : (e.target.value as Project['manualStatus']),
            }))
          }
        >
          <option value="auto">
            Automatisch (
            {projectStatus({ ...project, manualStatus: undefined })})
          </option>
          {projectStatuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <p className="muted small">
        Eine manuelle Auswahl gilt für die Projektfilter; einzelne Szenen
        behalten ihren Status.
      </p>
      <details>
        <summary>Projektvorlagen ({library.templates?.length || 0})</summary>
        <p className="muted small">
          Speichert Kapitel, Szenentitel, Zusammenfassungen, Module und Ziele.
          Manuskripttexte, Kommentare, Cover und Figuren werden nicht
          übernommen.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLibrary((l) => saveTemplate(l, project, name));
            setName('');
            setMessage('Vorlage gespeichert.');
          }}
        >
          <label className="field-label">
            VORLAGENNAME
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="text-button" disabled={disabled || !name.trim()}>
            Aktuelles Projekt als Vorlage speichern
          </button>
        </form>
        {!!library.templates?.length && (
          <label className="field-label">
            TITEL DES NEUEN PROJEKTS
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leer lassen: Name der Vorlage"
            />
          </label>
        )}
        {library.templates?.map((t) => (
          <div className="template-row" key={t.id}>
            <strong>{t.name}</strong>
            <button
              disabled={disabled}
              onClick={() => {
                const next = instantiateTemplate(library, t.id, title);
                setLibrary(next);
                select(next.projects.at(-1)!.scenes[0].id);
                setMessage('Neues Projekt aus Vorlage angelegt.');
              }}
            >
              Neues Projekt daraus
            </button>
            <button
              disabled={disabled}
              onClick={() => {
                setLibrary((l) => ({
                  ...l,
                  templates: l.templates?.filter((x) => x.id !== t.id),
                }));
                setMessage(
                  'Vorlage entfernt. Bestehende Projekte bleiben erhalten.',
                );
              }}
            >
              Vorlage entfernen
            </button>
          </div>
        ))}
      </details>
      {message && <output>{message}</output>}
    </section>
  );
}
export function PurgeButton({
  library,
  setLibrary,
  id,
  disabled,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  id: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState('');
  const name =
    library.snapshots.find((s) => s.project.id === id)?.project.title ||
    'Ohne Titel';
  return (
    <>
      <button
        className="project-delete-button"
        disabled={disabled}
        onClick={() => {
          setConfirmation('');
          setOpen(true);
        }}
      >
        Endgültig löschen
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>„{name}“ endgültig löschen?</DialogTitle>
          <DialogDescription>
            Entfernt dieses Projekt, sein Cover und alle Projektversionen aus
            dem Papierkorb und lokalen Update-Sicherungen. Gemeinsame
            Romanwelten, Vorlagen und bereits heruntergeladene Dateien bleiben
            erhalten. Diese Aktion lässt sich nicht rückgängig machen.
          </DialogDescription>
          <label className="field-label">
            ZUR BESTÄTIGUNG „LÖSCHEN“ EINGEBEN
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button
            className="project-delete-button"
            disabled={disabled || confirmation !== 'LÖSCHEN'}
            onClick={() => {
              setLibrary((l) => purgeProject(l, id));
              setOpen(false);
            }}
          >
            Unwiderruflich löschen
          </button>
          <button onClick={() => setOpen(false)}>Abbrechen</button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SharedWorldPanel({
  library,
  setLibrary,
  project,
  disabled,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  project: Project;
  disabled: boolean;
}) {
  const [name, setName] = useState(''),
    [editing, setEditing] = useState<Card | null>(null),
    [query, setQuery] = useState('');
  const world = library.worlds?.find((w) => w.id === project.worldId);
  function connect(id: string) {
    setEditing(null);
    setLibrary((l) => ({
      ...l,
      projects: l.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              worldId: id || undefined,
              updated: new Date().toISOString(),
            }
          : p,
      ),
    }));
  }
  return (
    <section className="shared-world">
      <h2>Gemeinsame Romanwelt</h2>
      <p className="muted small">
        Figuren und Orte zentral pflegen und in mehreren Projekten verwenden.
        Änderungen hier gelten für alle verbundenen Projekte; lokale Karten
        bleiben getrennt.
      </p>
      <label className="field-label">
        ROMANWELT DIESES PROJEKTS
        <select
          disabled={disabled}
          value={world?.id || ''}
          onChange={(e) => connect(e.target.value)}
        >
          <option value="">Keine gemeinsame Romanwelt</option>
          {library.worlds?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const id = uid();
          setLibrary((l) => ({
            ...l,
            worlds: [...(l.worlds || []), { id, name: name.trim(), cards: [] }],
            projects: l.projects.map((p) =>
              p.id === project.id ? { ...p, worldId: id } : p,
            ),
          }));
          setName('');
        }}
      >
        <input
          aria-label="Name der neuen Romanwelt"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={project.series.title || 'Neue Romanwelt'}
        />
        <button disabled={disabled || !name.trim()}>Romanwelt anlegen</button>
      </form>
      {world && (
        <>
          <label className="field-label">
            NAME DER ROMANWELT
            <input
              disabled={disabled}
              value={world.name}
              onChange={(e) =>
                setLibrary((l) => ({
                  ...l,
                  worlds: l.worlds?.map((w) =>
                    w.id === world.id ? { ...w, name: e.target.value } : w,
                  ),
                }))
              }
            />
          </label>
          <p className="muted small">
            Verbunden:{' '}
            {library.projects
              .filter((p) => p.worldId === world.id)
              .map((p) => p.title)
              .join(', ')}
          </p>
          <div className="review-options">
            <button
              disabled={disabled}
              onClick={() =>
                setEditing({
                  id: uid(),
                  kind: 'Figur',
                  title: '',
                  subtitle: '',
                  text: '',
                  stage: 'Sammlung',
                })
              }
            >
              Gemeinsame Figur / Ort hinzufügen
            </button>
            <button
              disabled={disabled}
              onClick={() =>
                setLibrary((l) => ({
                  ...l,
                  worlds: l.worlds?.map((w) =>
                    w.id === world.id
                      ? {
                          ...w,
                          cards: [
                            ...w.cards,
                            ...project.cards
                              .filter(
                                (c) =>
                                  (c.kind === 'Figur' || c.kind === 'Ort') &&
                                  !w.cards.some(
                                    (x) =>
                                      x.kind === c.kind &&
                                      x.title.trim().toLocaleLowerCase('de') ===
                                        c.title.trim().toLocaleLowerCase('de'),
                                  ),
                              )
                              .map((c) => ({ ...c, id: uid() })),
                          ],
                        }
                      : w,
                  ),
                }))
              }
            >
              Lokale Figuren & Orte hineinkopieren
            </button>
          </div>
          <input
            aria-label="Gemeinsame Romanwelt durchsuchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Figur oder Ort suchen"
          />
          <div className="shared-card-list">
            {world.cards
              .filter((c) =>
                (c.title + ' ' + c.text)
                  .toLocaleLowerCase('de')
                  .includes(query.toLocaleLowerCase('de')),
              )
              .map((c) => (
                <button key={c.id} onClick={() => setEditing({ ...c })}>
                  <strong>{c.title}</strong>
                  <small>
                    {c.kind} · {c.subtitle}
                  </small>
                  <p>{c.text.slice(0, 160)}</p>
                </button>
              ))}
          </div>
          {!world.cards.length && (
            <p>Noch keine gemeinsamen Figuren oder Orte.</p>
          )}
        </>
      )}
      <Dialog
        open={!!editing && !!world}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="card-dialog">
          <DialogTitle>Gemeinsame Karte bearbeiten</DialogTitle>
          <DialogDescription>
            Änderungen gelten in allen Projekten der Romanwelt „{world?.name}“.
          </DialogDescription>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!world) return;
                setLibrary((l) => ({
                  ...l,
                  worlds: l.worlds?.map((w) =>
                    w.id === world.id
                      ? {
                          ...w,
                          cards: w.cards.some((c) => c.id === editing.id)
                            ? w.cards.map((c) =>
                                c.id === editing.id ? editing : c,
                              )
                            : [...w.cards, editing],
                        }
                      : w,
                  ),
                }));
                setEditing(null);
              }}
            >
              <label className="field-label">
                ART
                <select
                  value={editing.kind}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      kind: e.target.value as Card['kind'],
                    })
                  }
                >
                  <option>Figur</option>
                  <option>Ort</option>
                </select>
              </label>
              <label className="field-label">
                {editing.kind === 'Figur' ? 'ANZEIGENAME' : 'NAME'}
                <input
                  required
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <label className="field-label">
                KURZBESCHREIBUNG
                <input
                  value={editing.subtitle}
                  onChange={(e) =>
                    setEditing({ ...editing, subtitle: e.target.value })
                  }
                />
              </label>
              {editing.kind === 'Figur' && (
                <CharacterFields
                  value={editing.character}
                  change={(character) => setEditing({ ...editing, character })}
                />
              )}
              <label className="field-label">
                DETAILS
                <textarea
                  rows={7}
                  value={editing.text}
                  onChange={(e) =>
                    setEditing({ ...editing, text: e.target.value })
                  }
                />
              </label>
              <button
                className="primary-button"
                disabled={disabled || !editing.title.trim()}
              >
                Für alle verbundenen Projekte speichern
              </button>
              {world?.cards.some((c) => c.id === editing.id) && (
                <button
                  type="button"
                  className="project-delete-button"
                  disabled={disabled}
                  onClick={() => {
                    if (
                      !world ||
                      !window.confirm(
                        `„${editing.title}“ aus der gemeinsamen Romanwelt und damit aus allen verbundenen Projekten entfernen? Dies lässt sich nicht rückgängig machen.`,
                      )
                    )
                      return;
                    setLibrary((l) => ({
                      ...l,
                      worlds: l.worlds?.map((w) =>
                        w.id === world.id
                          ? {
                              ...w,
                              cards: w.cards.filter((c) => c.id !== editing.id),
                            }
                          : w,
                      ),
                    }));
                    setEditing(null);
                  }}
                >
                  Gemeinsame Karte löschen
                </button>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
