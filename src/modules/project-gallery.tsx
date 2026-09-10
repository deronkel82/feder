import { useState, useRef } from 'react';
import { GripVertical, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Library } from '../core/model';
import {
  formatNames,
  projectFormat,
  type ProjectFormat,
} from '../core/project-format';
import {
  visibleProjects,
  moveProject,
  type ProjectSort,
} from '../core/project-gallery';
import { ProjectCover } from './covers';
function usePreference<T extends string>(
  key: string,
  fallback: T,
  values: readonly T[],
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key) as T;
      return values.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  return [
    value,
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        /* preference only */
      }
    },
  ] as const;
}
export function ProjectGallery({
  library,
  setLibrary,
  select,
  disabled,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  select: (id: string) => void;
  disabled: boolean;
}) {
  const [size, setSize] = usePreference('feder.gallery.size', 'medium', [
    'small',
    'medium',
    'large',
  ] as const);
  const [filter, setFilter] = usePreference<ProjectFormat | 'all'>(
    'feder.gallery.filter',
    'all',
    ['all', 'novel', 'novella', 'short', 'other'],
  );
  const [sort, setSort] = usePreference<ProjectSort>(
    'feder.gallery.sort',
    'manual',
    ['manual', 'alphabet', 'updated'],
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const gallery = useRef<HTMLDivElement>(null);
  const list = visibleProjects(library.projects, filter, sort);
  function move(id: string, to: string) {
    setLibrary((l) => moveProject(l, id, to));
    setMessage('Reihenfolge gespeichert.');
  }
  function hit(x: number, y: number) {
    const element = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-project-id]');
    return element && gallery.current?.contains(element)
      ? element.dataset.projectId || null
      : null;
  }
  return (
    <section className="project-browser" aria-label="Projektbibliothek">
      <div className="gallery-controls">
        <label>
          Projektart
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ProjectFormat | 'all')}
          >
            <option value="all">Alle Projekte</option>
            {Object.entries(formatNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sortierung
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProjectSort)}
          >
            <option value="manual">Freie Reihenfolge</option>
            <option value="alphabet">Alphabet (A–Z)</option>
            <option value="updated">Zuletzt geändert</option>
          </select>
        </label>
        <label>
          Covergröße
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as typeof size)}
          >
            <option value="small">Klein</option>
            <option value="medium">Mittel</option>
            <option value="large">Groß</option>
          </select>
        </label>
      </div>
      <p className="muted small">
        {list.length} von {library.projects.length} Projekten
        {sort === 'manual'
          ? ' · Am Griff ziehen oder mit den Pfeilen verschieben.'
          : ''}
      </p>
      <div
        ref={gallery}
        className={`project-list project-gallery gallery-${size}`}
      >
        {list.map((p, index) => (
          <article
            key={p.id}
            data-project-id={p.id}
            className={`gallery-card ${p.id === library.active ? 'current-project' : ''} ${dragging === p.id ? 'is-dragging' : ''} ${target === p.id && target !== dragging ? 'drop-target' : ''}`}
          >
            <button
              className="gallery-select"
              aria-pressed={p.id === library.active}
              onClick={() => {
                setLibrary((l) => ({ ...l, active: p.id }));
                select(p.scenes[0].id);
              }}
            >
              <ProjectCover project={p} />
              <span className="project-card-caption">
                <strong>{p.title || 'Ohne Titel'}</strong>
                <small>{formatNames[projectFormat(p)]}</small>
              </span>
              {p.id === library.active && (
                <small className="project-active-badge">Aktiv</small>
              )}
            </button>
            {sort === 'manual' && (
              <div className="gallery-move-controls">
                <button
                  disabled={disabled || index === 0}
                  aria-label={`${p.title} nach vorne verschieben`}
                  onClick={() => move(p.id, list[index - 1].id)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  className="gallery-drag"
                  disabled={disabled}
                  aria-label={`${p.title} ziehen zum Verschieben`}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDragging(p.id);
                    setTarget(p.id);
                  }}
                  onPointerMove={(e) => {
                    if (dragging !== p.id) return;
                    setTarget(hit(e.clientX, e.clientY));
                    const box = gallery.current?.getBoundingClientRect();
                    if (box && gallery.current) {
                      if (e.clientY < box.top + 45)
                        gallery.current.scrollBy(0, -18);
                      else if (e.clientY > box.bottom - 45)
                        gallery.current.scrollBy(0, 18);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (dragging === p.id) {
                      const to = hit(e.clientX, e.clientY);
                      if (to) move(p.id, to);
                    }
                    setDragging(null);
                    setTarget(null);
                  }}
                  onPointerCancel={() => {
                    setDragging(null);
                    setTarget(null);
                  }}
                  onLostPointerCapture={() => {
                    setDragging(null);
                    setTarget(null);
                  }}
                >
                  <GripVertical size={18} />
                </button>
                <button
                  disabled={disabled || index === list.length - 1}
                  aria-label={`${p.title} nach hinten verschieben`}
                  onClick={() => move(p.id, list[index + 1].id)}
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!list.length && (
        <p>
          Keine Projekte dieser Art. Wähle einen anderen Filter oder lege ein
          Projekt an.
        </p>
      )}
      {!list.some((p) => p.id === library.active) && (
        <p className="muted small">
          Das aktuell geöffnete Projekt ist durch den Filter ausgeblendet. Seine
          Einstellungen stehen weiterhin unten.
        </p>
      )}
      <output className="sr-only">{message}</output>
    </section>
  );
}
