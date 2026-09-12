import { SceneBoard } from './scene-board';
import { useState, useMemo, useDeferredValue } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  uid,
  words,
  type Library,
  type Project,
  type Card,
} from '../core/model';
import { chapterGroups } from '../core/chapters';
import {
  searchProject,
  differenceGroups,
  combineText,
  applyComparison,
  type SearchHit,
  type ReviewPass,
} from '../core/workbench';
import { reviseScene } from '../core/history';
type Props = {
  library: Library;
  project: Project;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  disabled: boolean;
  jump: (id: string, start: number, end: number) => void;
};
export function BookTools({
  open,
  setOpen,
  section,
  ...props
}: Props & { open: boolean; setOpen: (v: boolean) => void; section: string }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="project-dialog book-tools">
        <DialogTitle>Buchwerkzeuge · {props.project.title}</DialogTitle>
        <DialogDescription>
          Suchen, den Aufbau überblicken und dein Buch gezielt überarbeiten.
        </DialogDescription>
        <Tabs
          key={String(open) + section + props.project.id}
          defaultValue={section}
        >
          <TabsList className="book-tabs" aria-label="Buchwerkzeuge">
            {[
              ['search', 'Überall suchen'],
              ['overview', 'Überblick'],
              ['board', 'Szenenwand'],
              ['review', 'Prüflisten'],
              ['names', 'Namen'],
              ['compare', 'Vergleichen'],
            ].map(([id, title]) => (
              <TabsTrigger key={id} value={id}>
                {title}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="search">
            <ProjectSearch {...props} />
          </TabsContent>
          <TabsContent value="overview">
            <ChapterOverview {...props} close={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="board">
            <SceneBoard {...props} />
          </TabsContent>
          <TabsContent value="review">
            <ReviewPasses {...props} />
          </TabsContent>
          <TabsContent value="names">
            <Names {...props} />
          </TabsContent>
          <TabsContent value="compare">
            <CompareProjects {...props} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
function ProjectSearch({
  project,
  library,
  setLibrary,
  disabled,
  jump,
}: Props) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('Alle'),
    [limit, setLimit] = useState(50),
    [hit, setHit] = useState<SearchHit | null>(null),
    [draft, setDraft] = useState(''),
    [message, setMessage] = useState('');
  const [openedLibrary, setOpenedLibrary] = useState<Library | null>(null);
  const deferred = useDeferredValue(query);
  const results = useMemo(
    () => searchProject(project, library, deferred),
    [project, library, deferred],
  );
  const filtered = results.filter(
    (h) => category === 'Alle' || h.category === category,
  );
  function open(h: SearchHit) {
    setHit(h);
    setOpenedLibrary(library);
    setMessage('');
    if (h.cardId) {
      const c = (
        h.worldId
          ? library.worlds?.find((w) => w.id === h.worldId)?.cards
          : project.cards
      )?.find((c) => c.id === h.cardId);
      setDraft(c?.text || '');
    } else {
      const s = project.scenes.find((s) => s.id === h.sceneId);
      setDraft(
        h.field === 'comment'
          ? h.text
          : String(
              s?.[
                h.field as
                  | 'text'
                  | 'title'
                  | 'chapter'
                  | 'synopsis'
                  | 'notes'
                  | 'pov'
              ] || '',
            ),
      );
    }
  }
  return (
    <section>
      <label className="field-label">
        Im gesamten Projekt suchen
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(50);
            setHit(null);
          }}
          placeholder="Text, Idee, Kommentar oder Name …"
        />
      </label>
      <label className="field-label">
        Bereich
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setLimit(50);
          }}
        >
          <option>Alle</option>
          {[...new Set(results.map((h) => h.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <output>
        {query.trim()
          ? `${filtered.length} Treffer in Textabschnitten und Karten`
          : 'Gib einen Suchbegriff ein.'}
      </output>
      <div className="book-results">
        {filtered.slice(0, limit).map((h) => (
          <button key={h.key} onClick={() => open(h)}>
            <small>{h.category}</small>
            <strong>{h.title}</strong>
            <span>
              {h.text.slice(
                Math.max(0, (h.field === 'comment' ? 0 : h.start) - 70),
                Math.max(0, (h.field === 'comment' ? 0 : h.start) - 70) + 210,
              )}
            </span>
          </button>
        ))}
      </div>
      {filtered.length > limit && (
        <button onClick={() => setLimit((n) => n + 50)}>
          Weitere 50 Treffer
        </button>
      )}
      {hit && (
        <section className="settings-info">
          <h3>
            {hit.category} · {hit.title}
          </h3>
          <textarea
            aria-label="Gefundener Inhalt"
            value={draft}
            readOnly={hit.field === 'comment' || hit.field === 'chapter'}
            onChange={(e) => setDraft(e.target.value)}
            rows={7}
          />
          {hit.field === 'comment' && (
            <p>
              Kommentare kannst du im Manuskript über „Kommentare“ bearbeiten.
            </p>
          )}
          <div className="review-options">
            {hit.sceneId && (
              <button
                onClick={() =>
                  jump(
                    hit.sceneId!,
                    hit.field === 'text' || hit.field === 'comment'
                      ? hit.start
                      : 0,
                    hit.field === 'text' || hit.field === 'comment'
                      ? hit.end
                      : 0,
                  )
                }
              >
                Im Manuskript öffnen
              </button>
            )}
            {hit.field !== 'comment' && hit.field !== 'chapter' && (
              <button
                disabled={disabled}
                onClick={() => {
                  if (openedLibrary !== library) {
                    setMessage(
                      'Inhalte wurden geändert. Bitte Treffer erneut öffnen.',
                    );
                    return;
                  }
                  setLibrary((l) => {
                    if (l !== library) return l;
                    if (hit.cardId) {
                      const change = (cards: Card[]) =>
                        cards.map((c) =>
                          c.id === hit.cardId ? { ...c, text: draft } : c,
                        );
                      return hit.worldId
                        ? {
                            ...l,
                            worlds: l.worlds?.map((w) =>
                              w.id === hit.worldId
                                ? { ...w, cards: change(w.cards) }
                                : w,
                            ),
                          }
                        : {
                            ...l,
                            projects: l.projects.map((p) =>
                              p.id === project.id
                                ? {
                                    ...p,
                                    cards: change(p.cards),
                                    updated: new Date().toISOString(),
                                  }
                                : p,
                            ),
                          };
                    }
                    return reviseScene(l, hit.sceneId!, { [hit.field]: draft });
                  });
                  setMessage('Änderung übernommen.');
                  setHit(null);
                }}
              >
                Änderung speichern
              </button>
            )}
          </div>
        </section>
      )}
      <output>{message}</output>
    </section>
  );
}
function ChapterOverview({
  project,
  jump,
  close,
}: Props & { close: () => void }) {
  return (
    <section>
      <p className="muted">
        Kapitel öffnen, um direkt weiterzuschreiben. Die Zusammenfassungen
        zeigen deine Planung.
      </p>
      {chapterGroups(project).map((g) => (
        <section key={g.key}>
          {g.part && <h3>{g.part}</h3>}
          {g.chapters.map((c) => (
            <article className="chapter-overview" key={c.name}>
              <button
                onClick={() => {
                  close();
                  jump(c.scenes[0].id, 0, 0);
                }}
              >
                <strong>{c.label}</strong>
                <span>
                  {words(c.scenes.map((s) => s.text).join('\n'))} Wörter ·{' '}
                  {[...new Set(c.scenes.map((s) => s.status))].join(', ')}
                </span>
              </button>
              <p className="muted">
                Perspektive:{' '}
                {[...new Set(c.scenes.map((s) => s.pov).filter(Boolean))].join(
                  ', ',
                ) || 'Noch nicht angegeben'}
              </p>
              {c.scenes.map((s) => (
                <div key={s.id}>
                  <strong>{s.title}</strong>
                  <p className="preserve-text">
                    {s.synopsis || 'Noch keine Zusammenfassung.'}
                  </p>
                </div>
              ))}
            </article>
          ))}
        </section>
      ))}
    </section>
  );
}
function ReviewPasses({ project, setLibrary, disabled }: Props) {
  const [title, setTitle] = useState(''),
    [checks, setChecks] = useState(
      'Dialoge wirken natürlich\nPerspektive bleibt stimmig\nHandlung und Zeitablauf sind nachvollziehbar',
    );
  const update = (fn: (passes: ReviewPass[]) => ReviewPass[]) =>
    setLibrary((l) => ({
      ...l,
      projects: l.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              reviewPasses: fn(p.reviewPasses || []),
              updated: new Date().toISOString(),
            }
          : p,
      ),
    }));
  return (
    <section>
      <p>
        Eigene Durchgänge sind unabhängig vom Projektstatus. Hake jeden
        Prüfpunkt kapitelweise ab. Neue Szenen machen das Kapitel wieder offen.
      </p>
      <details>
        <summary>Neuen Überarbeitungsdurchgang anlegen</summary>
        <label className="field-label">
          Name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Zum Beispiel: Dialoge und Perspektive"
          />
        </label>
        <label className="field-label">
          Prüfpunkte – einer pro Zeile
          <textarea
            rows={4}
            value={checks}
            onChange={(e) => setChecks(e.target.value)}
          />
        </label>
        <button
          disabled={disabled || !title.trim() || !checks.trim()}
          onClick={() => {
            update((ps) => [
              ...ps,
              {
                id: uid(),
                title: title.trim(),
                checks: checks
                  .split('\n')
                  .filter((t) => t.trim())
                  .map((text) => ({ id: uid(), text: text.trim() })),
                completed: [],
              },
            ]);
            setTitle('');
          }}
        >
          Durchgang anlegen
        </button>
      </details>
      {(project.reviewPasses || []).map((pass) => (
        <details key={pass.id} className="release-entry">
          <summary>
            {pass.title} ·{' '}
            {
              pass.completed.filter((k) =>
                project.scenes.some((s) => k.startsWith(s.id + ':')),
              ).length
            }{' '}
            / {project.scenes.length * pass.checks.length} Szenen-Prüfpunkte
          </summary>
          {chapterGroups(project)
            .flatMap((g) => g.chapters)
            .map((c) => (
              <section key={c.name}>
                <h4>{c.label}</h4>
                {pass.checks.map((check) => {
                  const keys = c.scenes.map((s) => s.id + ':' + check.id);
                  return (
                    <label className="format-check" key={check.id}>
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={keys.every((k) => pass.completed.includes(k))}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          update((ps) =>
                            ps.map((p) =>
                              p.id === pass.id
                                ? {
                                    ...p,
                                    completed: checked
                                      ? [...new Set([...p.completed, ...keys])]
                                      : p.completed.filter(
                                          (k) => !keys.includes(k),
                                        ),
                                  }
                                : p,
                            ),
                          );
                        }}
                      />
                      {check.text}
                    </label>
                  );
                })}
              </section>
            ))}
          <button
            disabled={disabled}
            onClick={() =>
              update((ps) =>
                ps.map((p) => (p.id === pass.id ? { ...p, completed: [] } : p)),
              )
            }
          >
            Häkchen dieses Durchgangs zurücksetzen
          </button>
        </details>
      ))}
      {!project.reviewPasses?.length && <p>Noch kein Durchgang angelegt.</p>}
    </section>
  );
}
function Names({ project, library, setLibrary, disabled }: Props) {
  const world = library.worlds?.find((w) => w.id === project.worldId);
  const cards = [
    ...project.cards.map((c) => ({ card: c, worldId: '' })),
    ...(world?.cards || []).map((c) => ({ card: c, worldId: world!.id })),
  ].filter((x) => ['Figur', 'Ort'].includes(x.card.kind));
  return (
    <section>
      <p>
        Verknüpfe Spitznamen und andere Schreibweisen mit einer Figur oder einem
        Ort. Die Erkennung führt diese Namen unter dem Haupteintrag zusammen.
      </p>
      {cards.map(({ card, worldId }) => (
        <NameEditor
          key={worldId + card.id}
          card={card}
          shared={!!worldId}
          disabled={disabled}
          save={(next) =>
            setLibrary((l) =>
              worldId
                ? {
                    ...l,
                    worlds: l.worlds?.map((w) =>
                      w.id === worldId
                        ? {
                            ...w,
                            cards: w.cards.map((c) =>
                              c.id === next.id
                                ? {
                                    ...c,
                                    title: next.title,
                                    aliases: next.aliases,
                                  }
                                : c,
                            ),
                          }
                        : w,
                    ),
                  }
                : {
                    ...l,
                    projects: l.projects.map((p) =>
                      p.id === project.id
                        ? {
                            ...p,
                            cards: p.cards.map((c) =>
                              c.id === next.id
                                ? {
                                    ...c,
                                    title: next.title,
                                    aliases: next.aliases,
                                  }
                                : c,
                            ),
                            updated: new Date().toISOString(),
                          }
                        : p,
                    ),
                  },
            )
          }
        />
      ))}
      {!cards.length && (
        <p>
          Lege Figuren oder Orte in deiner Romanwelt an oder bestätige einen
          Erkennungsvorschlag.
        </p>
      )}
      <details>
        <summary>
          Verworfene Erkennungen ({project.dismissedEntities.length})
        </summary>
        {project.dismissedEntities.map((key) => (
          <div className="review-options" key={key}>
            <span>{key}</span>
            <button
              disabled={disabled}
              onClick={() =>
                setLibrary((l) => ({
                  ...l,
                  projects: l.projects.map((p) =>
                    p.id === project.id
                      ? {
                          ...p,
                          dismissedEntities: p.dismissedEntities.filter(
                            (k) => k !== key,
                          ),
                        }
                      : p,
                  ),
                }))
              }
            >
              Wieder berücksichtigen
            </button>
          </div>
        ))}
      </details>
    </section>
  );
}
function NameEditor({
  card,
  shared,
  disabled,
  save,
}: {
  card: Card;
  shared: boolean;
  disabled: boolean;
  save: (c: Card) => void;
}) {
  const [title, setTitle] = useState(card.title),
    [aliases, setAliases] = useState((card.aliases || []).join('\n')),
    [saved, setSaved] = useState(false);
  return (
    <details className="release-entry">
      <summary>
        {card.title} · {card.kind}
        {shared ? ' · Gemeinsame Romanwelt' : ''}
      </summary>
      <label className="field-label">
        Hauptname
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <label className="field-label">
        Aliasnamen – einer pro Zeile
        <textarea
          value={aliases}
          onChange={(e) => {
            setAliases(e.target.value);
            setSaved(false);
          }}
          placeholder="Anna\nOma Anna\nFrau Winter"
        />
      </label>
      <button
        disabled={disabled || !title.trim()}
        onClick={() => {
          save({
            ...card,
            title: title.trim(),
            aliases: [
              ...new Set(
                aliases
                  .split('\n')
                  .map((a) => a.trim())
                  .filter(Boolean),
              ),
            ],
          });
          setSaved(true);
        }}
      >
        Namen speichern
      </button>
      {saved && <output> Gespeichert</output>}
    </details>
  );
}
function CompareProjects({ library, project, setLibrary, disabled }: Props) {
  const candidates = library.projects.filter((p) => p.id !== project.id);
  const [sourceId, setSource] = useState(
    candidates.find(
      (p) => p.id.startsWith(project.id + '-sync-') && !p.syncResolved,
    )?.id ||
      candidates[0]?.id ||
      '',
  );
  const source = candidates.find((p) => p.id === sourceId);
  const [snapshot, setSnapshot] = useState<{
      target: Project;
      source: Project;
    } | null>(null),
    [texts, setTexts] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(''),
    [comparisonRun, setComparisonRun] = useState(0);
  return (
    <section>
      <p>
        Übernimm ausgewählte Textänderungen in „{project.title}“. Karten und
        andere Projekteinstellungen bleiben erhalten. Beide Ausgangsfassungen
        werden vor dem Speichern als Version gesichert; das Quellprojekt bleibt
        bestehen.
      </p>
      <label className="field-label">
        Andere Fassung
        <select
          value={sourceId}
          onChange={(e) => {
            setSource(e.target.value);
            setSnapshot(null);
            setTexts({});
          }}
        >
          <option value="">Bitte wählen</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.syncResolved ? ' · bereits geprüft' : ''}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!source}
        onClick={() => {
          setSnapshot({ target: project, source: source! });
          setComparisonRun((n) => n + 1);
          setTexts({});
          setMessage('');
        }}
      >
        Vergleich öffnen
      </button>
      {snapshot && (
        <>
          <p className="muted">
            Nur ausgewählte Textabschnitte werden geändert. Nicht vorhandene
            Szenen lassen sich vollständig hinzufügen. Unterschiedliche
            Szenen-IDs werden nicht automatisch als dieselbe Szene behandelt.
          </p>
          {snapshot.source.scenes.every((remote) =>
            snapshot.target.scenes.some(
              (local) => local.id === remote.id && local.text === remote.text,
            ),
          ) && <p>Keine übernehmbaren Textänderungen gefunden.</p>}
          {snapshot.source.scenes.map((remote) => {
            const local = snapshot.target.scenes.find(
              (s) => s.id === remote.id,
            );
            if (local?.text === remote.text) return null;
            return (
              <SceneComparison
                key={remote.id + snapshot.source.id + comparisonRun}
                title={remote.title}
                before={local?.text || ''}
                after={remote.text}
                exists={!!local}
                onChange={(value) =>
                  setTexts((t) => {
                    const next = { ...t };
                    if (value === undefined) delete next[remote.id];
                    else next[remote.id] = value;
                    return next;
                  })
                }
              />
            );
          })}
          <button
            className="primary-button"
            disabled={disabled || !Object.keys(texts).length}
            onClick={() => {
              try {
                const result = applyComparison(
                  library,
                  snapshot.target,
                  snapshot.source,
                  texts,
                );
                setLibrary(result);
                setSnapshot(null);
                setMessage(
                  'Ausgewählte Texte übernommen. Originalfassungen sind unter Versionen gesichert.',
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Ausgewählte Änderungen speichern
          </button>
        </>
      )}
      <output>{message}</output>
    </section>
  );
}
function SceneComparison({
  title,
  before,
  after,
  exists,
  onChange,
}: {
  title: string;
  before: string;
  after: string;
  exists: boolean;
  onChange: (v: string | undefined) => void;
}) {
  const groups = useMemo(
    () => differenceGroups(before, after),
    [before, after],
  );
  const [picked, setPicked] = useState<number[]>([]);
  return (
    <details className="release-entry">
      <summary>
        {title}
        {exists ? ' · Textänderungen' : ' · Neue Szene'}
      </summary>
      <div className="comparison-columns">
        <section>
          <h4>Aktuelle Fassung</h4>
          <pre>{before || 'Kein Text'}</pre>
        </section>
        <section>
          <h4>Andere Fassung</h4>
          <pre>{after || 'Kein Text'}</pre>
        </section>
      </div>
      {groups.map((g, i) =>
        g.same ? null : (
          <label
            className="comparison-change"
            key={i}
            aria-label="Textänderung übernehmen"
          >
            <input
              type="checkbox"
              checked={picked.includes(i)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...picked, i]
                  : picked.filter((n) => n !== i);
                setPicked(next);
                onChange(
                  next.length ? combineText(before, after, next) : undefined,
                );
              }}
            />
            <span>
              <strong>Änderung übernehmen</strong>
              <del>{g.before || '(Einfügung)'}</del>
              <ins>{g.after || '(Löschung)'}</ins>
            </span>
          </label>
        ),
      )}
      {!exists && before === after && (
        <button onClick={() => onChange(after)}>
          Leere geplante Szene übernehmen
        </button>
      )}
    </details>
  );
}
