import { useState } from 'react';
import { BookOpen, Upload, Trash2, Maximize2 } from 'lucide-react';
import type { Project } from '../core/model';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { readCover } from './cover-image';
export function ProjectCover({
  project,
  className = '',
}: {
  project: Pick<Project, 'title' | 'cover'>;
  className?: string;
}) {
  return (
    <span className={`project-cover ${className}`} aria-hidden="true">
      {project.cover ? (
        // Already resized locally; data URLs need no remote image optimizer.
        // oxlint-disable-next-line next/no-img-element
        <img src={project.cover} alt="" />
      ) : (
        <>
          <BookOpen size={24} />
          <span>
            {project.title.trim().slice(0, 1).toLocaleUpperCase('de') || 'f'}
          </span>
        </>
      )}
    </span>
  );
}
export function CoverEditor({
  project,
  change,
}: {
  project: Project;
  change: (projectId: string, cover?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <section className="cover-editor">
      <ProjectCover project={project} />
      <div>
        <h3>Buchcover</h3>
        <CoverFullscreen project={project} />
        <p className="muted small">
          JPG, PNG oder WebP · maximal 20 MB. Das Bild wird platzsparend auf
          diesem Gerät gespeichert und in JSON-Sicherungen mitgenommen.
        </p>
        <label className={`cover-upload ${busy ? 'cover-busy' : ''}`}>
          <Upload size={16} />
          {busy
            ? 'Cover wird vorbereitet …'
            : project.cover
              ? 'Cover ersetzen'
              : 'Cover hinzufügen'}
          <input
            disabled={busy}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Buchcover auswählen"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const id = project.id;
              setBusy(true);
              setMessage('');
              try {
                const cover = await readCover(file);
                change(id, cover);
                setMessage('Cover gespeichert.');
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'Cover konnte nicht gespeichert werden.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {project.cover && (
          <button
            disabled={busy}
            className="text-button"
            onClick={() => {
              change(project.id);
              setMessage('Cover entfernt.');
            }}
          >
            <Trash2 size={14} />
            Cover entfernen
          </button>
        )}
        {message && <output className="cover-message">{message}</output>}
      </div>
    </section>
  );
}

export function CoverFullscreen({
  project,
}: {
  project: Pick<Project, 'title' | 'cover'>;
}) {
  const [open, setOpen] = useState(false);
  if (!project.cover) return null;
  return (
    <>
      <button
        type="button"
        className="cover-fullscreen-trigger"
        aria-label={`Cover von ${project.title || 'Ohne Titel'} im Vollbild anzeigen`}
        onClick={() => setOpen(true)}
      >
        <Maximize2 size={16} /> Cover ansehen
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="cover-fullscreen"
          aria-describedby={undefined}
        >
          <DialogTitle>{project.title || 'Buchcover'}</DialogTitle>
          {/* Local, validated image data. */}
          {/* oxlint-disable-next-line next/no-img-element */}
          <img src={project.cover} alt={`Buchcover: ${project.title}`} />
        </DialogContent>
      </Dialog>
    </>
  );
}
