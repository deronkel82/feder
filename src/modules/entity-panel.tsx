import { isShort, usesScenes } from '../core/project-format';
import { useEffect, useState, useRef } from 'react';
import { uid, type Project } from '../core/model';
import type { Entity } from './entities';
import { RefreshCw } from 'lucide-react';
export function useEntities(project: Project) {
  const [request, setRequest] = useState(0);
  const [result, setResult] = useState<{
    project: Project | null;
    request: number;
    entities: Entity[];
    error: string;
    checkedAt: string;
  }>({ project: null, request: -1, entities: [], error: '', checkedAt: '' });
  const seq = useRef(0);
  const lastManualRequest = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    let cancelled = false;
    const manual = request !== lastManualRequest.current;
    lastManualRequest.current = request;
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (entities: Entity[], error = '') => {
      if (cancelled || id !== seq.current) return;
      setResult({
        project,
        request,
        entities,
        error,
        checkedAt: new Date().toLocaleTimeString('de', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
      clearTimeout(timeout);
      worker?.terminate();
    };
    const timer = setTimeout(
      () => {
        try {
          worker = new Worker(
            new URL('./entities.worker.ts', import.meta.url),
            { type: 'module' },
          );
          timeout = setTimeout(
            () =>
              finish(
                [],
                'Die Erkennung dauert zu lange. Bitte erneut versuchen.',
              ),
            20000,
          );
          worker.onmessage = (e) => {
            if (e.data.id === id) finish(e.data.result);
          };
          worker.onerror = () =>
            finish(
              [],
              'Erkennung derzeit nicht verfügbar. Bitte erneut versuchen.',
            );
          worker.postMessage({ id, project });
        } catch {
          finish(
            [],
            'Erkennung derzeit nicht verfügbar. Bitte erneut versuchen.',
          );
        }
      },
      manual ? 0 : 700,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      worker?.terminate();
    };
  }, [project, request]);
  const sameProject = result.project?.id === project.id;
  return {
    entities: sameProject ? result.entities : [],
    error: sameProject ? result.error : '',
    scanning: result.project !== project || result.request !== request,
    checkedAt: sameProject ? result.checkedAt : '',
    rescan: () => setRequest((n) => n + 1),
  };
}
function acceptEntity(p: Project, e: Entity, kind: Entity['kind']): Project {
  const exists = p.cards.some(
    (c) =>
      c.kind === kind &&
      c.title.trim().toLocaleLowerCase('de') === e.name.toLocaleLowerCase('de'),
  );
  return {
    ...p,
    cards: exists
      ? p.cards
      : [
          ...p.cards,
          {
            id: uid(),
            title: e.name,
            kind,
            subtitle: 'Aus dem Manuskript übernommen',
            text: '',
            stage: 'Sammlung',
          },
        ],
    dismissedEntities:
      kind !== e.kind
        ? [...new Set([...p.dismissedEntities, e.key])]
        : p.dismissedEntities,
  };
}
export function EntityPanel({
  entities,
  error,
  scanning,
  checkedAt,
  rescan,
  project,
  update,
}: {
  entities: Entity[];
  error: string;
  scanning: boolean;
  checkedAt: string;
  rescan: () => void;
  project: Project;
  update: (f: (p: Project) => Project) => void;
}) {
  return (
    <section className="entity-panel">
      <h2>Im Text entdeckt</h2>
      <p className="muted small">
        Automatische lokale Hinweise auf Figuren und Orte. Bitte prüfe die
        Zuordnung; die Erkennung kann Namen übersehen oder Nomen verwechseln.
      </p>
      <div className="entity-scan-controls">
        <button onClick={rescan} disabled={scanning}>
          <RefreshCw size={15} />
          {scanning ? 'Wird geprüft …' : 'Erneut erkennen'}
        </button>
        <output>
          {scanning
            ? 'Das aktuelle Buch wird lokal geprüft.'
            : error || (checkedAt ? 'Zuletzt geprüft: ' + checkedAt : '')}
        </output>
      </div>
      {!entities.length && !error && !scanning && (
        <p className="muted small">
          Noch keine Namen erkannt. Vorschläge erscheinen automatisch beim
          Schreiben oder Textimport.
        </p>
      )}
      {entities.slice(0, 40).map((e) => (
        <div className="entity-row" key={e.key}>
          <strong>{e.name}</strong>
          <small>
            {e.kind} · {e.sceneIds.length}{' '}
            {isShort(project)
              ? 'Text'
              : usesScenes(project)
                ? 'Szenen'
                : 'Kapitel'}
            {e.knownId ? ' · Bereits in deiner Romanwelt' : ''}
          </small>
          <p>{e.context}</p>
          {!e.knownId && (
            <div>
              <button onClick={() => update((p) => acceptEntity(p, e, e.kind))}>
                Als {e.kind} übernehmen
              </button>
              <button
                onClick={() =>
                  update((p) =>
                    acceptEntity(p, e, e.kind === 'Figur' ? 'Ort' : 'Figur'),
                  )
                }
              >
                {e.kind === 'Figur' ? 'Ist ein Ort' : 'Ist eine Figur'}
              </button>
              <button
                onClick={() =>
                  update((p) => ({
                    ...p,
                    dismissedEntities: [...p.dismissedEntities, e.key],
                  }))
                }
              >
                Verwerfen
              </button>
            </div>
          )}
        </div>
      ))}
      {project.dismissedEntities.length > 0 && (
        <button
          className="text-button"
          onClick={() => update((p) => ({ ...p, dismissedEntities: [] }))}
        >
          Verworfene Vorschläge erneut prüfen
        </button>
      )}
    </section>
  );
}
