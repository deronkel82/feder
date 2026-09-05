import { useSidebar } from '@/components/ui/sidebar';
import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  FileText,
} from 'lucide-react';
import { chapterGroups } from '../core/chapters';
import type { Project } from '../core/model';
import type { StructureSelection } from './structure';
export function ManuscriptTree({
  project,
  query,
  selected,
  open,
  manage,
}: {
  project: Project;
  query: string;
  selected: string;
  open: (id: string) => void;
  manage: (s: StructureSelection) => void;
}) {
  const { setOpenMobile } = useSidebar();
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem('feder.navigation.closed') || '[]',
      );
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const key = (kind: string, id: string) =>
    JSON.stringify([project.id, kind, id]);
  const isOpen = (k: string) => !!query || !closed.includes(k);
  const toggle = (k: string) => {
    const next = closed.includes(k)
      ? closed.filter((x) => x !== k)
      : [...closed, k];
    setClosed(next);
    try {
      localStorage.setItem('feder.navigation.closed', JSON.stringify(next));
    } catch {
      /* local preference only */
    }
  };
  const groups = chapterGroups(project)
    .map((g) => ({
      ...g,
      chapters: g.chapters
        .map((c) => ({
          ...c,
          scenes: c.scenes.filter((s) =>
            (
              s.title +
              ' ' +
              s.text +
              ' ' +
              s.synopsis +
              ' ' +
              c.label +
              ' ' +
              g.part
            )
              .toLocaleLowerCase('de')
              .includes(query.toLocaleLowerCase('de')),
          ),
        }))
        .filter((c) => c.scenes.length),
    }))
    .filter((g) => g.chapters.length);
  return (
    <div className="scene-list manuscript-tree">
      {groups.map((g) => (
        <div key={g.key}>
          {g.part && (
            <button
              className="part-heading"
              aria-expanded={isOpen(key('part', g.key))}
              onClick={() => toggle(key('part', g.key))}
            >
              {isOpen(key('part', g.key)) ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
              <span>{g.part}</span>
              <small>{g.chapters.length}</small>
            </button>
          )}
          {(!g.part || isOpen(key('part', g.key))) &&
            g.chapters.map((c) => (
              <div key={c.name} className={g.part ? 'chapter-in-part' : ''}>
                <div className="chapter-label">
                  <button
                    className="chapter-toggle"
                    aria-expanded={isOpen(key('chapter', c.name))}
                    onClick={() => toggle(key('chapter', c.name))}
                  >
                    {isOpen(key('chapter', c.name)) ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    <span>{c.label}</span>
                    <small>{c.scenes.length}</small>
                  </button>
                  <button
                    title="Kapitel bearbeiten"
                    aria-label={`Kapitel ${c.label} bearbeiten`}
                    onClick={() => manage({ kind: 'chapter', id: c.name })}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                {isOpen(key('chapter', c.name)) &&
                  c.scenes.map((s) => (
                    <div className="scene-nav-row" key={s.id}>
                      <button
                        className={`scene-button ${selected === s.id ? 'selected' : ''}`}
                        onClick={() => {
                          open(s.id);
                          setOpenMobile(false);
                        }}
                      >
                        <FileText size={14} />
                        <span>{s.title}</span>
                        <span className={`status-dot status-${s.status}`} />
                      </button>
                      <button
                        className="scene-options"
                        title="Szene verwalten"
                        aria-label={`Szene ${s.title} verwalten`}
                        onClick={() => manage({ kind: 'scene', id: s.id })}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  ))}
              </div>
            ))}
        </div>
      ))}
      {!groups.length && (
        <p className="muted empty-small">Keine Szene gefunden.</p>
      )}
    </div>
  );
}
