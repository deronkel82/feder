import {
  FormatFields,
  ProjectModeSettings,
  LimitFields,
} from './project-options';
import {
  configureProject,
  projectFormat,
  isShort,
  usesScenes,
  defaultTarget,
  formatNames,
} from '../core/project-format';
import { chapterGroups } from '../core/chapters';
import { useState } from 'react';
import { Plus, Download, Upload, BookOpen } from 'lucide-react';
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
import { SeriesFields, seriesLabel } from './series';
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
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
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
        const p = newProject(file.name.replace(/\.[^.]+$/, ''));
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
        const ids = new Map(imported.projects.map((p) => [p.id, uid()]));
        const projects = imported.projects.map((p) => ({
          ...p,
          id: ids.get(p.id)!,
        }));
        const snapshots = imported.snapshots
          .filter((s) => ids.has(s.project.id))
          .map((s) => ({
            ...s,
            id: uid(),
            project: { ...s.project, id: ids.get(s.project.id)! },
          }));
        setLibrary((l) => ({
          ...l,
          projects: [...l.projects, ...projects],
          active: projects[0].id,
          snapshots: [...snapshots, ...l.snapshots],
        }));
        select(projects[0].scenes[0].id);
      }
      setMessage('Importiert. Bestehende Projekte bleiben erhalten.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import fehlgeschlagen.');
    }
  }
  const manuscript = () =>
    `# ${project.title}\n\n${project.author ? project.author + '\n\n' : ''}` +
    (isShort(project)
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
      <DialogContent className="project-dialog">
        <DialogTitle>Deine Projekte.</DialogTitle>
        <DialogDescription>
          Alles bleibt lokal auf diesem Gerät. Sichere regelmäßig eine Kopie
          deiner Arbeit.
        </DialogDescription>
        <div className="project-list">
          {library.projects.map((p) => (
            <button
              className={p.id === library.active ? 'current-project' : ''}
              key={p.id}
              onClick={() => {
                setLibrary((l) => ({ ...l, active: p.id }));
                select(p.scenes[0].id);
              }}
            >
              <BookOpen size={20} />
              <span>
                {p.title}
                <small>
                  {formatNames[projectFormat(p)]} ·{' '}
                  {isShort(p)
                    ? 'Ein Text'
                    : p.scenes.length +
                      (usesScenes(p) ? ' Szenen' : ' Kapitel')}{' '}
                  {!isShort(p) && p.series.enabled
                    ? ' · ' + seriesLabel(p.series)
                    : ''}
                </small>
              </span>
              {p.id === library.active && <small>Aktiv</small>}
            </button>
          ))}
        </div>
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
                projects: [...l.projects, draft],
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
                  sceneMode: format === 'short' ? false : sceneMode,
                  target:
                    format !== projectFormat(draft)
                      ? defaultTarget(format)
                      : draft.target,
                  series:
                    format === 'short'
                      ? { ...draft.series, enabled: false }
                      : draft.series,
                })
              }
            />
            <LimitFields project={draft} update={(fn) => setDraft(fn)} />
            {!isShort(draft) && (
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
          <label className="field-label">
            AUTOR / AUTORIN
            <input
              value={project.author}
              onChange={(e) =>
                update((p) => ({ ...p, author: e.target.value }))
              }
            />
          </label>
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
        {!isShort(project) && (
          <SeriesFields
            value={project.series}
            onChange={(series) => update((p) => ({ ...p, series }))}
          />
        )}
        <h2 className="dialog-section">Mitnehmen & sichern</h2>
        <div className="export-grid">
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
                  ? 'Sicherungen vor Updates / Datenumstellungen:'
                  : 'Noch keine Update-Sicherung vorhanden.',
              );
            } catch {
              setMessage('Sicherungen derzeit nicht lesbar.');
            }
          }}
        >
          Update-Sicherungen anzeigen
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
