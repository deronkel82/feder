import { useState } from 'react';
import {
  Plus,
  ArrowUpRight,
  MapPin,
  UserRound,
  Lightbulb,
  Library,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Choice } from '../App';
import { uid, type Card, type Project } from '../core/model';
type Props = {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
};
export function CardsView({
  kind,
  project,
  update,
}: Props & { kind: Card['kind'] }) {
  const [filter, setFilter] = useState<Card['kind']>(kind);
  const actual = kind === 'Figur' ? filter : kind;
  const [editing, setEditing] = useState<Card | null>(null);
  const [query, setQuery] = useState('');
  const cards = project.cards.filter(
    (c) =>
      c.kind === actual &&
      (c.title + ' ' + c.text).toLowerCase().includes(query.toLowerCase()),
  );
  const board = kind === 'Idee';
  const Icon =
    actual === 'Figur'
      ? UserRound
      : actual === 'Ort'
        ? MapPin
        : actual === 'Idee'
          ? Lightbulb
          : Library;
  const titles = {
    Figur: 'Deine Geschichte lebt.',
    Ort: 'Orte, die bleiben.',
    Idee: 'Jeder Anfang ist eine Idee.',
    Recherche: 'Wissen für deine Welt.',
  };
  function add() {
    setEditing({
      id: uid(),
      title: '',
      subtitle: '',
      text: '',
      kind: actual,
      stage: 'Sammlung',
    });
  }
  const card = (c: Card) => (
    <button
      key={c.id}
      className={`story-card card-${c.kind}`}
      onClick={() => setEditing({ ...c })}
    >
      <div className="card-top">
        <span className="card-symbol">
          <Icon size={22} />
        </span>
        <ArrowUpRight size={16} />
      </div>
      <h2>{c.title}</h2>
      <small>{c.subtitle || c.kind}</small>
      <p>{c.text || 'Hier ist noch Platz für deine Gedanken.'}</p>
      <div className="card-bottom">
        {c.kind}
        <span>Bearbeiten →</span>
      </div>
    </button>
  );
  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {board
              ? 'RAUM FÜR MÖGLICHKEITEN'
              : kind === 'Recherche'
                ? 'DEIN WISSENSARCHIV'
                : 'DEINE ROMANWELT'}
          </p>
          <h1>{titles[actual]}</h1>
          <p className="muted">
            {board
              ? 'Lose Gedanken. Neue Verbindungen. Der nächste große Einfall.'
              : kind === 'Recherche'
                ? 'Quellen, Beobachtungen und alles, was deine Geschichte glaubwürdig macht.'
                : 'Menschen und Schauplätze, die deiner Geschichte Tiefe geben.'}
          </p>
        </div>
        <button className="primary-button" onClick={add}>
          <Plus size={18} />
          {actual === 'Figur'
            ? 'Neue Figur'
            : actual === 'Ort'
              ? 'Neuer Ort'
              : actual === 'Idee'
                ? 'Neue Idee'
                : 'Neue Notiz'}
        </button>
      </div>
      <div className="module-controls">
        {kind === 'Figur' && (
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as Card['kind'])}
          >
            <TabsList>
              <TabsTrigger value="Figur">Figuren</TabsTrigger>
              <TabsTrigger value="Ort">Orte</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Karten durchsuchen"
            placeholder="Durchsuchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="muted small">
          {cards.length} {cards.length === 1 ? 'Karte' : 'Karten'}
        </span>
      </div>
      {board ? (
        <div className="board-columns">
          {(['Sammlung', 'Entwicklung', 'Im Manuskript'] as const).map(
            (stage, i) => (
              <section key={stage}>
                <h2 className="column-heading">
                  <span className={`column-dot dot-${i}`} />
                  {stage}
                  <span>{cards.filter((c) => c.stage === stage).length}</span>
                </h2>
                {cards.filter((c) => c.stage === stage).map(card)}
                <button
                  className="add-card"
                  onClick={() =>
                    setEditing({
                      id: uid(),
                      title: '',
                      subtitle: '',
                      text: '',
                      kind: 'Idee',
                      stage,
                    })
                  }
                >
                  <Plus size={17} />
                  Idee hinzufügen
                </button>
              </section>
            ),
          )}
        </div>
      ) : (
        <div className="cards-grid">
          {cards.map(card)}
          {cards.length === 0 && (
            <div className="empty-state">
              <Icon size={32} />
              <h2>Ein neues Kapitel für deine Ideen.</h2>
              <p>Lege deine erste Karte an oder passe die Suche an.</p>
              <button className="primary-button" onClick={add}>
                Karte anlegen
              </button>
            </div>
          )}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="card-dialog">
          <DialogTitle>{editing?.kind} bearbeiten</DialogTitle>
          <DialogDescription>
            Halte fest, was für deine Geschichte zählt.
          </DialogDescription>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                update((p) => ({
                  ...p,
                  cards: p.cards.some((c) => c.id === editing.id)
                    ? p.cards.map((c) => (c.id === editing.id ? editing : c))
                    : [...p.cards, editing],
                }));
                setEditing(null);
              }}
            >
              <label className="field-label">
                NAME ODER TITEL
                <input
                  required
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <label className="field-label">
                {editing.kind === 'Recherche'
                  ? 'QUELLE / URL'
                  : 'KURZBESCHREIBUNG'}
                <input
                  value={editing.subtitle}
                  onChange={(e) =>
                    setEditing({ ...editing, subtitle: e.target.value })
                  }
                />
              </label>
              <label className="field-label">
                NOTIZEN
                <textarea
                  className="card-notes"
                  value={editing.text}
                  onChange={(e) =>
                    setEditing({ ...editing, text: e.target.value })
                  }
                />
              </label>
              {board && (
                <div className="field-label">
                  ENTWICKLUNGSSTAND
                  <Choice
                    label="Entwicklungsstand"
                    value={editing.stage}
                    options={['Sammlung', 'Entwicklung', 'Im Manuskript']}
                    onChange={(s) =>
                      setEditing({ ...editing, stage: s as Card['stage'] })
                    }
                  />
                </div>
              )}
              <button className="primary-button" type="submit">
                Karte speichern
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
export function TimelineView({
  project,
  update,
  openScene,
}: Props & { openScene: (s: string) => void }) {
  const scenes = [...project.scenes].sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999'),
  );
  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DER RHYTHMUS DEINER GESCHICHTE</p>
          <h1>Alles hat seine Zeit.</h1>
          <p className="muted">
            Chronologisch geplant. Die Reihenfolge im Manuskript bleibt
            unabhängig.
          </p>
        </div>
      </div>
      <div className="timeline">
        {scenes.map((s) => (
          <div className="timeline-row" key={s.id}>
            <div className="time-label">
              <label>
                <span className="sr-only">Zeitpunkt für {s.title}</span>
                <input
                  type="datetime-local"
                  value={s.date}
                  onChange={(e) =>
                    update((p) => ({
                      ...p,
                      scenes: p.scenes.map((x) =>
                        x.id === s.id ? { ...x, date: e.target.value } : x,
                      ),
                    }))
                  }
                />
              </label>
              <small>
                {s.date ? 'Handlungszeit' : 'Noch nicht eingeordnet'}
              </small>
            </div>
            <span className="timeline-point" />
            <button className="timeline-card" onClick={() => openScene(s.id)}>
              <small>
                {s.chapter} · {s.status}
              </small>
              <h2>{s.title}</h2>
              <p>
                {s.synopsis ||
                  'Füge in den Szenendetails eine Zusammenfassung hinzu.'}
              </p>
              <span>
                {s.pov || 'Perspektive offen'}
                <ArrowUpRight size={17} />
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
