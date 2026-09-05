import { useEffect, useState, useRef } from 'react';
import { uid, type Project } from '../core/model';
import type { Entity } from './entities';
export function useEntities(project: Project) {
  const [result, setResult] = useState<{
    projectId: string;
    entities: Entity[];
  }>({ projectId: '', entities: [] });
  const [error, setError] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const id = ++seq.current;
    let worker: Worker | undefined;
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL('./entities.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = (e) => {
          if (e.data.id === seq.current) {
            setResult({ projectId: project.id, entities: e.data.result });
            setError('');
          }
          worker?.terminate();
        };
        worker.onerror = () => {
          setError('Erkennung derzeit nicht verfügbar.');
          worker?.terminate();
        };
        worker.postMessage({ id, project });
      } catch {
        setError('Erkennung derzeit nicht verfügbar.');
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [project]);
  return {
    entities: result.projectId === project.id ? result.entities : [],
    error,
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
  project,
  update,
}: {
  entities: Entity[];
  error: string;
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
      {error && <p>{error}</p>}
      {!entities.length && !error && (
        <p className="muted small">
          Noch keine Namen erkannt. Vorschläge erscheinen automatisch beim
          Schreiben oder Textimport.
        </p>
      )}
      {entities.slice(0, 40).map((e) => (
        <div className="entity-row" key={e.key}>
          <strong>{e.name}</strong>
          <small>
            {e.kind} · {e.sceneIds.length} Szenen
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
