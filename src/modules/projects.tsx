import { ExportPreview } from './export-preview';
import { ProjectExtras, PurgeButton } from './library-extras';
import { AuthorFields } from './authors';
import { applyDefaultAuthor, setDefaultAuthor } from '../core/authors';
import { ProjectGallery } from './project-gallery';
import { CoverEditor } from './covers';
import { setProjectCover } from '../core/cover-data';
import {
  deleteProject,
  deletedProjects,
  restoreDeletedProject,
} from '../core/project-deletion';
import {
  FormatFields,
  ProjectModeSettings,
  LimitFields,
} from './project-options';
import {
  configureProject,
  projectFormat,
  isStandalone,
  isOther,
  usesScenes,
  defaultTarget,
} from '../core/project-format';
import { chapterGroups } from '../core/chapters';
import { useState } from 'react';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  newProject,
  uid,
  validateLibrary,
  type Project,
  type Library,
} from '../core/model';
import {
  download,
  safeName,
  rawBackup,
  recoveryBackups,
} from '../core/storage';
import { SeriesFields } from './series';
import { Versions } from './versions';
export function ProjectDialog({
  open,
  setOpen,
  library,
  setLibrary,
  project,
  update,
  select,
  error,
}: {
  open: boolean;
  setOpen: (s: boolean) => void;
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  select: (id: string) => void;
  error: string | null;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleting = library.projects.find((p) => p.id === deleteId);
  const deleted = deletedProjects(library);
  const [draft, setDraft] = useState(() => newProject(''));
  const [recoveries, setRecoveries] = useState<
    Awaited<ReturnType<typeof recoveryBackups>>
  >([]);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024)
        throw Error('Datei zu groß (maximal 30 MB).');
      const text = await file.text();
      if (file.name.match(/\.(md|txt)$/i)) {
        const p = applyDefaultAuthor(
          newProject(file.name.replace(/\.[^.]+$/, '')),
          library.defaultAuthor,
        );
        p.scenes[0].text = text;
        p.scenes[0].status = 'Entwurf';
        setLibrary((l) => ({
          ...l,
          projects: [...l.projects, p],
          active: p.id,
        }));
        select(p.scenes[0].id);
      } else {
        const imported = validateLibrary(JSON.parse(text));
        const ids = new Map(
          [
            ...new Set([
              ...imported.projects.map((p) => p.id),
              ...imported.snapshots.map((s) => s.project.id),
            ]),
          ].map((id) => [id, uid()]),
        );
        const worldIds = new Map(
          (imported.worlds || []).map((w) => [w.id, uid()]),
        );
        const remapWorld = (p: Project) => ({
          ...p,
          worldId: p.worldId ? worldIds.get(p.worldId) : undefined,
        });
        const importDefault =
          library.defaultAuthor ?? imported.defaultAuthor ?? '';
        const projects = imported.projects.map((p) => ({
          ...applyDefaultAuthor(
            {
              ...remapWorld(p),
              authorOverride:
                p.authorOverride === true ||
                (p.authorOverride !== false && !!p.author.trim()) ||
                (!!p.author.trim() && p.author !== importDefault),
            },
            importDefault,
          ),
          id: ids.get(p.id)!,
        }));
        const snapshots = imported.snapshots.map((s) => ({
          ...s,
          id: uid(),
          project: { ...remapWorld(s.project), id: ids.get(s.project.id)! },
        }));
        setLibrary((l) => {
          const base = setDefaultAuthor(
            l,
            l.defaultAuthor ?? imported.defaultAuthor ?? '',
          );
          return {
            ...base,
            worlds: [
              ...(base.worlds || []),
              ...(imported.worlds || []).map((w) => ({
                ...w,
                id: worldIds.get(w.id)!,
              })),
            ],
            templates: [
              ...(base.templates || []),
              ...(imported.templates || []).map((t) => ({
                ...t,
                id: uid(),
                project: { ...remapWorld(t.project), id: uid() },
              })),
            ],
            projects: [...base.projects, ...projects],
            active: projects[0].id,
            snapshots: [...snapshots, ...base.snapshots],
          };
        });
        select(projects[0].scenes[0].id);
      }
      setMessage('Importiert. Bestehende Projekte bleiben erhalten.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import fehlgeschlagen.');
    }
  }
  const manuscript = () =>
    `# ${project.title}\n\n${project.author ? project.author + '\n\n' : ''}` +
    (isStandalone(project)
      ? project.scenes[0].text
      : chapterGroups(project)
          .map(
            (g) =>
              (g.part ? '## ' + g.part + '\n\n' : '') +
              g.chapters
                .map(
                  (c) =>
                    `### ${c.label}\n\n` +
                    c.scenes
                      .map(
                        (s) =>
                          `${usesScenes(project) ? '#### ' + s.title + '\n\n' : ''}${s.text}`,
                      )
                      .join('\n\n'),
                )
                .join('\n\n'),
          )
          .join('\n\n'));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={`project-dialog ${fullscreen ? 'project-dialog-fullscreen' : ''}`}
      >
        <div className="project-dialog-heading">
          <DialogTitle>Deine Projekte.</DialogTitle>
          <button
            className="text-button"
            aria-pressed={fullscreen}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}{' '}
            {fullscreen ? 'Vollbild verlassen' : 'Vollbild'}
          </button>
        </div>
        <DialogDescription>
          Alles bleibt lokal auf diesem Gerät. Sichere regelmäßig eine Kopie
          deiner Arbeit.
        </DialogDescription>
        <ProjectGallery
          library={library}
          setLibrary={setLibrary}
          select={select}
          disabled={!!error}
        />
        <h2 className="dialog-section">Einstellungen: {project.title}</h2>
        <ProjectExtras
          library={library}
          setLibrary={setLibrary}
          project={project}
          update={update}
          select={select}
          disabled={!!error}
        />
        <CoverEditor
          key={project.id}
          project={project}
          change={(id, cover) =>
            setLibrary((l) => setProjectCover(l, id, cover))
          }
        />
        <button
          className="project-delete-button"
          disabled={!!error}
          onClick={() => setDeleteId(project.id)}
        >
          <Trash2 size={16} />
          Aktuelles Projekt löschen
        </button>
        {deleted.length > 0 && (
          <details className="deleted-projects">
            <summary>Papierkorb ({deleted.length})</summary>
            <p className="muted small">
              Diese Projekte sind aus der Projektliste entfernt. Ihre Inhalte
              und Versionen bleiben zur Wiederherstellung lokal gespeichert und
              sind in der kompletten JSON-Sicherung enthalten.
            </p>
            {deleted.map((v) => (
              <div className="deleted-project-row" key={v.project.id}>
                <span>
                  <strong>{v.project.title}</strong>
                  <small>{new Date(v.date).toLocaleString('de')}</small>
                </span>
                <button
                  type="button"
                  disabled={!!error}
                  onClick={() => {
                    const next = restoreDeletedProject(library, v.project.id);
                    setLibrary(next);
                    select(v.project.scenes[0].id);
                    setMessage(
                      'Projekt mit seinen Versionen wiederhergestellt.',
                    );
                  }}
                >
                  Wiederherstellen
                </button>
                <PurgeButton
                  library={library}
                  setLibrary={setLibrary}
                  id={v.project.id}
                  disabled={!!error}
                />
              </div>
            ))}
          </details>
        )}
        <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleteId(null)}>
          <DialogContent>
            <DialogTitle>Projekt „{deleting?.title}“ löschen?</DialogTitle>
            <DialogDescription>
              Das Projekt wird aus deiner Projektliste entfernt. Vorher wird
              sein vollständiger Stand gesichert. Über „Gelöschte Projekte“
              kannst du es samt Versionen wiederherstellen.
              {library.projects.length === 1
                ? ' Nach dem Löschen bleibt ein neues leeres Projekt zum Weiterschreiben.'
                : ''}
            </DialogDescription>
            <div className="form-actions">
              <button
                className="project-delete-button"
                disabled={!!error}
                onClick={() => {
                  if (!deleting) return;
                  const next = deleteProject(library, deleting.id);
                  setLibrary(next);
                  select(
                    next.projects.find((p) => p.id === next.active)!.scenes[0]
                      .id,
                  );
                  setDeleteId(null);
                  setCreating(false);
                  setMessage(
                    'Projekt gelöscht. Unter „Gelöschte Projekte“ kannst du es wiederherstellen.',
                  );
                }}
              >
                Projekt löschen
              </button>
              <button onClick={() => setDeleteId(null)}>Abbrechen</button>
            </div>
          </DialogContent>
        </Dialog>
        <button className="text-button" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Neues Projekt
        </button>
        {creating && (
          <form
            className="new-book-form"
            onSubmit={(e) => {
              e.preventDefault();
              setLibrary((l) => ({
                ...l,
                projects: [
                  ...l.projects,
                  applyDefaultAuthor(draft, l.defaultAuthor),
                ],
                active: draft.id,
              }));
              select(draft.scenes[0].id);
              setCreating(false);
              setDraft(newProject(''));
            }}
          >
            <h2>Neues Projekt anlegen</h2>
            <label className="field-label">
              TITEL
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <FormatFields
              format={projectFormat(draft)}
              sceneMode={usesScenes(draft)}
              change={(format, sceneMode) =>
                setDraft({
                  ...draft,
                  format,
                  sceneMode:
                    format === 'short' || format === 'other'
                      ? false
                      : sceneMode,
                  target:
                    format !== projectFormat(draft)
                      ? defaultTarget(format)
                      : draft.target,
                  series:
                    format === 'short' || format === 'other'
                      ? { ...draft.series, enabled: false }
                      : draft.series,
                })
              }
            />
            {!isOther(draft) && (
              <AuthorFields
                project={applyDefaultAuthor(draft, library.defaultAuthor)}
                defaultAuthor={library.defaultAuthor || ''}
                update={(fn) =>
                  setDraft((d) =>
                    fn(applyDefaultAuthor(d, library.defaultAuthor)),
                  )
                }
              />
            )}
            <LimitFields project={draft} update={(fn) => setDraft(fn)} />
            {!isStandalone(draft) && (
              <SeriesFields
                value={draft.series}
                onChange={(series) => setDraft({ ...draft, series })}
                required
              />
            )}
            <div className="form-actions">
              <button className="primary-button" type="submit">
                Projekt anlegen
              </button>
              <button type="button" onClick={() => setCreating(false)}>
                Abbrechen
              </button>
            </div>
          </form>
        )}

        <div className="project-fields">
          <label className="field-label">
            TITEL
            <input
              value={project.title}
              onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
            />
          </label>
          {!isOther(project) && (
            <AuthorFields
              project={project}
              defaultAuthor={library.defaultAuthor || ''}
              update={update}
            />
          )}
        </div>
        <ProjectModeSettings
          key={
            project.id + projectFormat(project) + String(usesScenes(project))
          }
          project={project}
          apply={(format, mode) => {
            setLibrary((l) => configureProject(l, format, mode));
            select(project.scenes[0].id);
            setMessage(
              'Projektart geändert. Der vorherige Stand ist als Version gesichert.',
            );
          }}
        />
        <LimitFields project={project} update={update} />
        {!isStandalone(project) && (
          <SeriesFields
            value={project.series}
            onChange={(series) => update((p) => ({ ...p, series }))}
          />
        )}
        <h2 className="dialog-section">Mitnehmen & sichern</h2>
        <div className="export-grid">
          <ExportPreview
            key={project.id}
            project={project}
            update={update}
            disabled={!!error}
          />
          <button
            onClick={() =>
              download(JSON.stringify(library, null, 2), 'Feder-Sicherung.json')
            }
          >
            <Download size={18} />
            <span>
              Komplette Sicherung
              <small>Alle Bücher, Karten und Versionen · JSON</small>
            </span>
          </button>
          <button
            onClick={() =>
              download(
                manuscript(),
                safeName(project.title) + '.md',
                'text/markdown',
              )
            }
          >
            <Download size={18} />
            <span>
              Manuskript<small>Markdown · offenes Textformat</small>
            </span>
          </button>
          <button
            onClick={async () => {
              try {
                const { exportEpub } = await import('./publishing');
                await exportEpub(project);
                setMessage('EPUB exportiert.');
              } catch {
                setMessage(
                  'EPUB-Export fehlgeschlagen. Bitte sichere dein Manuskript als Markdown.',
                );
              }
            }}
          >
            <Download size={18} />
            <span>
              E-Book<small>EPUB · für E-Reader</small>
            </span>
          </button>
          <button
            onClick={async () => {
              const { printBook } = await import('./publishing');
              printBook(project);
            }}
          >
            <Download size={18} />
            <span>
              Drucken / PDF<small>Über den Druckdialog deines Browsers</small>
            </span>
          </button>
          <label className="import-button">
            <Upload size={18} />
            <span>
              Importieren<small>Feder-Sicherung, Markdown oder Text</small>
            </span>
            <input
              type="file"
              accept=".json,.md,.txt"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {error && (
          <button
            className="text-button"
            onClick={async () => {
              try {
                download(await rawBackup(), 'Feder-Rohdaten.json');
              } catch {
                setMessage('Rohdaten sind nicht lesbar.');
              }
            }}
          >
            Gespeicherte Rohdaten retten
          </button>
        )}
        <Versions
          library={library}
          setLibrary={setLibrary}
          project={project}
          select={select}
        />
        <button
          className="text-button"
          onClick={async () => {
            try {
              const list = await recoveryBackups();
              setRecoveries(list);
              setMessage(
                list.length
                  ? 'Sicherungen vor Updates, Datenumstellungen oder Synchronisierung:'
                  : 'Noch keine automatische Sicherung vorhanden.',
              );
            } catch {
              setMessage('Sicherungen derzeit nicht lesbar.');
            }
          }}
        >
          Automatische Sicherungen anzeigen
        </button>
        {recoveries.map((r) => (
          <button
            className="text-button"
            key={r.key}
            onClick={() =>
              download(
                JSON.stringify(r.library, null, 2),
                'Feder-Update-Sicherung.json',
              )
            }
          >
            {r.reason} · {new Date(r.date).toLocaleString('de')} · Herunterladen
          </button>
        ))}
        {message && <output className="dialog-message">{message}</output>}
      </DialogContent>
    </Dialog>
  );
}
