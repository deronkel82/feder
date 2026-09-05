import { useState } from 'react';
import { Plus, Download, Upload, BookOpen, History } from 'lucide-react';
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
import { download, safeName, rawBackup } from '../core/storage';
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
          snapshots: [...snapshots, ...l.snapshots].slice(0, 50),
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
    project.scenes
      .map(
        (s, i) =>
          `${i === 0 || project.scenes[i - 1].chapter !== s.chapter ? '## ' + s.chapter + '\n\n' : ''}### ${s.title}\n\n${s.text}`,
      )
      .join('\n\n');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="project-dialog">
        <DialogTitle>Deine Bücher.</DialogTitle>
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
                <small>{p.scenes.length} Szenen</small>
              </span>
              {p.id === library.active && <small>Aktiv</small>}
            </button>
          ))}
        </div>
        <button
          className="text-button"
          onClick={() => {
            const p = newProject();
            setLibrary((l) => ({
              ...l,
              projects: [...l.projects, p],
              active: p.id,
            }));
            select(p.scenes[0].id);
          }}
        >
          <Plus size={16} />
          Neues Buch
        </button>
        <div className="project-fields">
          <label className="field-label">
            BUCHTITEL
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
          <label className="field-label">
            WORTZIEL
            <input
              type="number"
              min="1"
              max="10000000"
              value={project.target}
              onChange={(e) =>
                update((p) => ({
                  ...p,
                  target: Math.max(
                    1,
                    Math.min(10000000, Number(e.target.value) || 1),
                  ),
                }))
              }
            />
          </label>
        </div>
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
        <h2 className="dialog-section">
          <History size={17} />
          Gesicherte Versionen
        </h2>
        <p className="muted small">
          Beim Wiederherstellen wird auch dein aktueller Stand gesichert.
        </p>
        <div className="versions">
          {library.snapshots
            .filter((s) => s.project.id === project.id)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setLibrary((l) => ({
                    ...l,
                    projects: l.projects.map((p) =>
                      p.id === project.id ? structuredClone(s.project) : p,
                    ),
                    snapshots: [
                      {
                        id: uid(),
                        date: new Date().toISOString(),
                        project: structuredClone(project),
                      },
                      ...l.snapshots,
                    ].slice(0, 50),
                  }));
                  select(s.project.scenes[0].id);
                  setMessage(
                    'Version wiederhergestellt. Der vorherige Stand bleibt gesichert.',
                  );
                }}
              >
                {new Date(s.date).toLocaleString('de')}
                <span>Wiederherstellen</span>
              </button>
            ))}
          {!library.snapshots.some((s) => s.project.id === project.id) && (
            <p className="muted small">
              Noch keine Version. Nutze „Version sichern“ über deinem
              Manuskript.
            </p>
          )}
        </div>
        {message && <output className="dialog-message">{message}</output>}
      </DialogContent>
    </Dialog>
  );
}
