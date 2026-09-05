import { useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
let worker: Worker | null = null;
let sequence = 0;
async function lookup(q: string): Promise<string[][]> {
  worker ??= new Worker(new URL('./thesaurus.worker.ts', import.meta.url), {
    type: 'module',
  });
  const current = worker;
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(Error('Zeitüberschreitung'));
    }, 30000);
    function cleanup() {
      clearTimeout(timer);
      current.removeEventListener('message', receive);
      current.removeEventListener('error', failure);
    }
    function failure() {
      cleanup();
      current.terminate();
      worker = null;
      reject(Error('Wörterbuch nicht verfügbar'));
    }
    function receive(e: MessageEvent) {
      if (e.data.id !== id) return;
      cleanup();
      if (e.data.error) reject(Error());
      else resolve(e.data.groups);
    }
    current.addEventListener('message', receive);
    current.addEventListener('error', failure);
    current.postMessage({
      id,
      query: q,
      url: new URL('./thesaurus.json', document.baseURI).href,
    });
  });
}
export function Thesaurus({
  selected,
  onReplace,
}: {
  selected: string;
  onReplace: (s: string) => void;
}) {
  const [manual, setManual] = useState({ selected: '', query: '' });
  const query =
    manual.selected === selected ? manual.query : selected.trim().slice(0, 80);
  const setQuery = (query: string) => setManual({ selected, query });
  const [groups, setGroups] = useState<string[][]>([]);
  const [state, setState] = useState('idle');
  async function search(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;
    setState('loading');
    try {
      const g = await lookup(query);
      setGroups(g);
      setState(g.length ? 'ready' : 'empty');
    } catch {
      setState('error');
    }
  }
  return (
    <section className="thesaurus">
      <div className="thesaurus-title">
        <BookOpen size={18} />
        <h2>Das passende Wort.</h2>
      </div>
      <p className="muted small">
        Markiere ein Wort im Text oder suche hier nach Synonymen.
      </p>
      <form className="synonym-search" onSubmit={search}>
        <input
          aria-label="Synonyme suchen"
          placeholder="z. B. leise"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={80}
        />
        <button
          disabled={state === 'loading'}
          aria-label="Synonyme anzeigen"
          type="submit"
        >
          <Search size={18} />
        </button>
      </form>
      <div aria-live="polite">
        {state === 'loading' && <p>Wörterbuch wird geladen …</p>}
        {state === 'empty' && (
          <p className="muted small">
            Kein Eintrag gefunden. Versuche die Grundform des Wortes.
          </p>
        )}
        {state === 'error' && (
          <p className="error">
            Wörterbuch nicht verfügbar. Öffne die App einmal mit Internet und
            versuche es erneut.
          </p>
        )}
        {groups.map((group, i) => (
          <div className="synonym-group" key={i}>
            <small>Bedeutung {i + 1}</small>
            <div>
              {group.map((term) => (
                <button
                  key={term}
                  disabled={!selected}
                  title={
                    selected
                      ? 'Markiertes Wort ersetzen'
                      : 'Zum Ersetzen zuerst ein Wort im Manuskript markieren'
                  }
                  onClick={() =>
                    onReplace(term.replace(/\s*\([^)]*\)/g, '').trim())
                  }
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <a
        className="attribution"
        href="https://www.openthesaurus.de"
        target="_blank"
        rel="noreferrer"
      >
        OpenThesaurus ↗
      </a>
      <small className="muted block">
        Wortdaten: LGPL 2.1+ · Stand 04.09.2026
        <br />
        Lokal und offline. Keine Grammatikprüfung.
      </small>
    </section>
  );
}
