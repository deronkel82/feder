import { isShort, usesScenes } from './core/project-format';
import { WritingProgress } from './modules/writing-progress';
import { ManuscriptTree } from './modules/manuscript-tree';
import { chapterLabel, orderedScenes } from './core/chapters';
import { sendIdea } from './core/plotting';
import { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import {
  Feather,
  Plus,
  Search,
  Settings2,
  Download,
  Focus,
  PanelRight,
  Check,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Undo2,
  Sun,
  Moon,
  CloudOff,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { modules } from './modules/registry';
import { analyze } from './modules/analysis';
import { load, save } from './core/storage';
import {
  newScene,
  words,
  type Project,
  type Scene,
  type Library as LibraryData,
} from './core/model';
import { CardsView, TimelineView } from './modules/planning';
import { Thesaurus } from './modules/thesaurus';
import { useUpdates, UpdateNotice } from './modules/updates';
import { useEntities, EntityPanel } from './modules/entity-panel';
import { reviseScene } from './core/history';
import { Versions } from './modules/versions';
import { seriesLabel } from './modules/series';
import { ProjectDialog } from './modules/projects';
import { readDarkMode, storeDarkMode } from './core/preferences';
import {
  reorderInChapter,
  appendToChapter,
  changeStructure,
} from './core/structure';
import { StructureDialog, type StructureSelection } from './modules/structure';
const statuses = ['Idee', 'Entwurf', 'Überarbeitung', 'Fertig'];
export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function App() {
  const [initial, setInitial] = useState<Awaited<
    ReturnType<typeof load>
  > | null>(null);
  useEffect(() => {
    void load().then(setInitial);
  }, []);
  return initial ? (
    <Workspace initial={initial} />
  ) : (
    <div className="boot-screen">
      <Feather size={30} />
      <p>Dein Atelier wird geöffnet …</p>
    </div>
  );
}
function Workspace({ initial }: { initial: Awaited<ReturnType<typeof load>> }) {
  const [library, setLibrary] = useState(initial.library);
  const [saveError, setSaveError] = useState(initial.error);
  const [savedLibrary, setSavedLibrary] = useState<LibraryData | null>(null);
  const saved = savedLibrary === library;
  const [sideOpen, setSideOpen] = useState(true);
  const [view, setView] = useState('write');
  const [selected, setSelected] = useState(
    library.projects.find((p) => p.id === library.active)!.scenes[0].id,
  );
  const [panel, setPanel] = useState(window.innerWidth >= 1200);
  const [focus, setFocus] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [settings, setSettings] = useState(false);
  const [versionDialog, setVersionDialog] = useState(false);
  const [dark, setDark] = useState(readDarkMode);
  const [structure, setStructure] = useState<StructureSelection | null>(null);
  const [query, setQuery] = useState('');
  const [modulesOpen, setModulesOpen] = useState(() => {
    try {
      return localStorage.getItem('feder.navigation.modules') !== 'closed';
    } catch {
      return true;
    }
  });
  const [tab, setTab] = useState('details');
  const [selection, setSelection] = useState({ start: 0, end: 0, word: '' });
  const [offline, setOffline] = useState(!navigator.onLine);
  const [notice, setNotice] = useState('');
  const editor = useRef<HTMLTextAreaElement>(null);
  const p = library.projects.find((p) => p.id === library.active)!;
  const updates = useUpdates(library, saveError);
  const recognition = useEntities(p);
  const s = p.scenes.find((s) => s.id === selected) || p.scenes[0];
  const deferred = useDeferredValue(s.text);
  const findings = useMemo(() => analyze(deferred), [deferred]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    storeDarkMode(dark);
  }, [dark]);
  useEffect(() => {
    const fn = () => setOffline(!navigator.onLine);
    window.addEventListener('online', fn);
    window.addEventListener('offline', fn);
    return () => {
      window.removeEventListener('online', fn);
      window.removeEventListener('offline', fn);
    };
  }, []);
  useEffect(() => {
    if (initial.error) return;
    let current = true;
    void save(library)
      .then(() => {
        if (current) {
          setSaveError(null);
          setSavedLibrary(library);
        }
      })
      .catch((e) => {
        if (current) setSaveError(e.message);
      });
    return () => {
      current = false;
    };
  }, [library, initial.error]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!saved || saveError) {
        e.preventDefault();
        // Legacy Safari uses returnValue alongside preventDefault.
        // oxlint-disable-next-line typescript/no-deprecated
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved, saveError]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  function update(fn: (p: Project) => Project) {
    setLibrary((l) => ({
      ...l,
      projects: l.projects.map((x) =>
        x.id === l.active ? { ...fn(x), updated: new Date().toISOString() } : x,
      ),
    }));
  }
  const patch = (v: Partial<Scene>) =>
    setLibrary((l) => reviseScene(l, s.id, v));
  const go = (id: string) => {
    setView(id);
    setFocus(false);
  };
  function addScene() {
    if (!usesScenes(p)) {
      if (!isShort(p)) setStructure({ kind: 'new', id: '' });
      return;
    }
    const n = newScene(s.chapter);
    update((p) => ({
      ...p,
      scenes: orderedScenes({ ...p, scenes: appendToChapter(p.scenes, n) }),
    }));
    setSelected(n.id);
    setView('write');
  }
  function selectRange(start: number, end: number) {
    setView('write');
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(start, end);
    });
  }
  function format(mark: string) {
    const e = editor.current;
    if (!e) return;
    const a = e.selectionStart,
      b = e.selectionEnd;
    patch({
      text:
        s.text.slice(0, a) + mark + s.text.slice(a, b) + mark + s.text.slice(b),
    });
    requestAnimationFrame(() => {
      e.focus();
      e.setSelectionRange(a + mark.length, b + mark.length);
    });
  }
  return (
    <SidebarProvider open={sideOpen && !focus} onOpenChange={setSideOpen}>
      <div
        inert={updates.busy}
        className={`app-shell ${focus ? 'focus-mode' : ''}`}
      >
        <Sidebar className="app-sidebar">
          <div className="brand">
            <span className="brand-icon">
              <Feather size={23} />
            </span>
            <span>
              feder<span className="brand-dot">.</span>
            </span>
            <span className="edition">SCHREIBATELIER</span>
          </div>
          <button
            className="project-picker"
            onClick={() => setProjectDialog(true)}
          >
            <span className="book-cover">
              <BookOpen size={22} />
            </span>
            <span>
              <small>DEIN PROJEKT</small>
              <strong>{p.title}</strong>
              {!isShort(p) && p.series.enabled && (
                <small>{seriesLabel(p.series)}</small>
              )}
            </span>
            <MoreHorizontal size={18} />
          </button>
          <button
            className="module-collapse"
            aria-expanded={modulesOpen}
            onClick={() => {
              setModulesOpen(!modulesOpen);
              try {
                localStorage.setItem(
                  'feder.navigation.modules',
                  modulesOpen ? 'closed' : 'open',
                );
              } catch {
                /* local preference */
              }
            }}
          >
            <ChevronRight
              size={15}
              style={{ transform: modulesOpen ? 'rotate(90deg)' : undefined }}
            />
            {modulesOpen
              ? 'Werkzeuge'
              : modules.find((m) => m.id === view)?.label || 'Werkzeuge'}
            <small>{modulesOpen ? 'Einklappen' : 'Ausklappen'}</small>
          </button>
          {modulesOpen && (
            <Navigation view={view} go={go} enabled={p.enabled} />
          )}
          <div className="sidebar-divider" />
          <div className="section-label">
            <span>MANUSKRIPT</span>
            {!isShort(p) && (
              <div className="manuscript-add">
                <button
                  aria-label="Kapitel hinzufügen"
                  title="Kapitel hinzufügen"
                  onClick={() => setStructure({ kind: 'new', id: '' })}
                >
                  <BookOpen size={16} />
                </button>
                {usesScenes(p) && (
                  <button
                    aria-label="Szene hinzufügen"
                    title="Szene hinzufügen"
                    onClick={addScene}
                  >
                    <Plus size={17} />
                  </button>
                )}
              </div>
            )}
          </div>
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Manuskript durchsuchen"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isShort(p)
                  ? 'Text durchsuchen'
                  : usesScenes(p)
                    ? 'Szenen durchsuchen'
                    : 'Kapitel durchsuchen'
              }
            />
          </label>
          <ManuscriptTree
            project={p}
            query={query}
            selected={view === 'write' ? s.id : ''}
            open={(id) => {
              setSelected(id);
              setView('write');
            }}
            manage={setStructure}
          />
          <div className="sidebar-bottom">
            <WritingProgress project={p} />
          </div>
        </Sidebar>
        <main className="main-area">
          <header className="topbar">
            <div className="breadcrumb">
              <SidebarTrigger aria-label="Navigation öffnen" />
              <span>{modules.find((m) => m.id === view)?.label}</span>
              <ChevronRight size={14} />
              <span className="muted">
                {view === 'write' && !isShort(p)
                  ? chapterLabel(p, s.chapter)
                  : p.title}
              </span>
            </div>
            <div className="top-actions">
              <span
                className={`save-state ${saveError ? 'error' : ''}`}
                title={saveError || 'Auf diesem Gerät gespeichert'}
              >
                {offline ? <CloudOff size={14} /> : <Check size={14} />}
                <span>
                  {saveError
                    ? 'Speicherproblem'
                    : saved
                      ? 'Lokal gespeichert'
                      : 'Speichert …'}
                </span>
              </span>
              <button
                title="Projekte & Export"
                aria-label="Projekte & Export"
                onClick={() => setProjectDialog(true)}
              >
                <Download size={18} />
              </button>
              <button
                title="Module & Einstellungen"
                aria-label="Module & Einstellungen"
                onClick={() => setSettings(true)}
              >
                <Settings2 size={18} />
              </button>
              <UpdateNotice updates={updates} />
              <button
                title="Darstellung wechseln"
                aria-label="Darstellung wechseln"
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className={focus ? 'active-icon' : ''}
                aria-label="Fokusmodus"
                title="Fokusmodus"
                onClick={() => setFocus(!focus)}
              >
                <Focus size={18} />
              </button>
              <button
                aria-label="Werkstatt einblenden"
                title="Werkstatt"
                onClick={() => setPanel(!panel)}
              >
                <PanelRight size={18} />
              </button>
            </div>
          </header>
          {saveError && (
            <div className="error-banner" role="alert">
              {saveError}
            </div>
          )}
          <div className="work-area">
            {view === 'write' ? (
              <div className="editor-area">
                <div className="document-bar">
                  <div className="formatting">
                    <button
                      title="Fett (Markdown)"
                      aria-label="Fett"
                      onClick={() => format('**')}
                    >
                      <b>B</b>
                    </button>
                    <button
                      title="Kursiv (Markdown)"
                      aria-label="Kursiv"
                      onClick={() => format('*')}
                    >
                      <i>I</i>
                    </button>
                    <span className="toolbar-divider" />
                    <span className="font-label">Literarisch</span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setVersionDialog(true)}
                  >
                    <Undo2 size={15} />
                    Version sichern
                  </button>
                </div>
                <article className="manuscript">
                  {!isShort(p) && (
                    <div className="document-eyebrow">
                      {chapterLabel(p, s.chapter)}
                      {usesScenes(p) && (
                        <>
                          {' '}
                          / {String(p.scenes.indexOf(s) + 1).padStart(2, '0')}
                        </>
                      )}
                    </div>
                  )}
                  {usesScenes(p) ? (
                    <input
                      className="scene-title"
                      aria-label="Szenentitel"
                      value={s.title}
                      onChange={(e) => patch({ title: e.target.value })}
                    />
                  ) : isShort(p) ? (
                    <input
                      className="scene-title"
                      aria-label="Titel"
                      value={p.title}
                      onChange={(e) =>
                        update((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  ) : (
                    <h1 className="scene-title">
                      {chapterLabel(p, s.chapter)}
                    </h1>
                  )}
                  <div className="scene-meta">
                    <span className={`status-dot status-${s.status}`} />
                    {s.status}
                    <span>·</span>
                    {words(s.text)} Wörter<span>·</span>
                    {Math.max(1, Math.ceil(words(s.text) / 200))} Min. Lesezeit
                  </div>
                  {!s.text.trim() && (
                    <label className="planned-synopsis">
                      ZUSAMMENFASSUNG / PLANUNG
                      <textarea
                        value={s.synopsis}
                        onChange={(e) => patch({ synopsis: e.target.value })}
                        placeholder="Was soll in diesem Text passieren?"
                      />
                    </label>
                  )}
                  <textarea
                    ref={editor}
                    className="writing-text"
                    spellCheck
                    lang="de"
                    aria-label="Manuskripttext"
                    placeholder="Hier beginnt deine Geschichte …"
                    value={s.text}
                    onChange={(e) =>
                      patch({
                        text: e.target.value,
                        status: s.status === 'Idee' ? 'Entwurf' : s.status,
                      })
                    }
                    onSelect={(e) => {
                      const t = e.currentTarget;
                      setSelection({
                        start: t.selectionStart,
                        end: t.selectionEnd,
                        word: t.value.slice(t.selectionStart, t.selectionEnd),
                      });
                    }}
                  />
                  <div className="end-mark">◇</div>
                </article>
                <footer className="editor-footer">
                  <span>
                    <span className="live-dot" /> Raum für deine Geschichte.
                  </span>
                  <span>{s.text.length.toLocaleString('de')} Zeichen</span>
                </footer>
              </div>
            ) : view === 'timeline' ? (
              <TimelineView
                project={p}
                update={update}
                openScene={(id) => {
                  setSelected(id);
                  setView('write');
                }}
              />
            ) : view === 'language' ? (
              <div className="module-page">
                <div className="page-heading">
                  <div>
                    <p className="eyebrow">DEINE WERKSTATT</p>
                    <h1>Worte mit Wirkung.</h1>
                    <p className="muted">
                      Sprachliche Hinweise zu „{s.title}“.
                    </p>
                  </div>
                </div>
                <div className="language-grid">
                  <section className="surface-card">
                    <h2>Stilanalyse</h2>
                    <Findings findings={findings} select={selectRange} />
                  </section>
                  <section className="surface-card">
                    <Thesaurus
                      selected={selection.word}
                      onReplace={(word) => {
                        if (
                          selection.word &&
                          s.text.slice(selection.start, selection.end) ===
                            selection.word
                        ) {
                          patch({
                            text:
                              s.text.slice(0, selection.start) +
                              word +
                              s.text.slice(selection.end),
                          });
                          setSelection({ start: 0, end: 0, word: '' });
                          setNotice('Wort ersetzt.');
                        }
                      }}
                    />
                  </section>
                </div>
              </div>
            ) : (
              <div className="world-layout">
                <CardsView
                  key={view}
                  kind={
                    view === 'board'
                      ? 'Idee'
                      : view === 'research'
                        ? 'Recherche'
                        : 'Figur'
                  }
                  project={p}
                  update={update}
                  openScene={(id) => {
                    setSelected(id);
                    setView('write');
                  }}
                  sendIdea={(card, target) => {
                    const result = sendIdea(library, card, target);
                    setLibrary(result.library);
                    setSelected(result.sceneId);
                    setView('write');
                    setNotice(
                      'Idee in die Textplanung übernommen. Die Zusammenfassung steht bereit.',
                    );
                  }}
                />
                {view === 'world' && (
                  <EntityPanel {...recognition} project={p} update={update} />
                )}
              </div>
            )}{' '}
            {view === 'write' && panel && !focus && (
              <aside className="inspector">
                <div className="inspector-heading">
                  <span>Werkstatt</span>
                  <button
                    className="close-inspector"
                    onClick={() => setPanel(false)}
                    aria-label="Werkstatt schließen"
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <span className="edition">
                    {isShort(p) ? 'TEXT' : usesScenes(p) ? 'SZENE' : 'KAPITEL'}{' '}
                    {!isShort(p) &&
                      String(p.scenes.indexOf(s) + 1).padStart(2, '0')}
                  </span>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList className="inspector-tabs">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    {p.enabled.includes('language') && (
                      <TabsTrigger value="style">Sprache</TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
                {tab === 'details' || !p.enabled.includes('language') ? (
                  <div className="inspector-body">
                    <div className="field-label">
                      STATUS
                      <Choice
                        label="Szenenstatus"
                        value={s.status}
                        options={statuses}
                        onChange={(status) =>
                          patch({ status: status as Scene['status'] })
                        }
                      />
                    </div>
                    {!isShort(p) && (
                      <div className="field-label">
                        KAPITEL<span>{chapterLabel(p, s.chapter)}</span>
                        {usesScenes(p) && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setStructure({ kind: 'scene', id: s.id })
                            }
                          >
                            Szene verschieben / verwalten
                          </button>
                        )}
                        <button
                          className="text-button"
                          onClick={() =>
                            setStructure({ kind: 'chapter', id: s.chapter })
                          }
                        >
                          Kapitel verwalten
                        </button>
                      </div>
                    )}
                    <label className="field-label">
                      WAS PASSIERT?
                      <textarea
                        placeholder="Der Kern dieser Szene …"
                        value={s.synopsis}
                        onChange={(e) => patch({ synopsis: e.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      PERSPEKTIVE
                      <input
                        placeholder="Wer erzählt?"
                        value={s.pov}
                        onChange={(e) => patch({ pov: e.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      ZEITPUNKT
                      <input
                        type="datetime-local"
                        value={s.date}
                        onChange={(e) => patch({ date: e.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      DEINE NOTIZEN
                      <textarea
                        placeholder="Was du nicht vergessen möchtest …"
                        value={s.notes}
                        onChange={(e) => patch({ notes: e.target.value })}
                      />
                    </label>
                    {usesScenes(p) && (
                      <div className="reorder">
                        <button
                          disabled={
                            p.scenes.filter((x) => x.chapter === s.chapter)[0]
                              .id === s.id
                          }
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              scenes: reorderInChapter(p.scenes, s.id, -1),
                            }))
                          }
                        >
                          <ArrowUp size={15} />
                          Nach vorn
                        </button>
                        <button
                          disabled={
                            p.scenes
                              .filter((x) => x.chapter === s.chapter)
                              .at(-1)?.id === s.id
                          }
                          onClick={() =>
                            update((p) => ({
                              ...p,
                              scenes: reorderInChapter(p.scenes, s.id, 1),
                            }))
                          }
                        >
                          <ArrowDown size={15} />
                          Nach hinten
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="inspector-body">
                    <Findings findings={findings} select={selectRange} />
                    <div className="sidebar-divider" />
                    <Thesaurus
                      selected={selection.word}
                      onReplace={(word) => {
                        if (
                          selection.word &&
                          s.text.slice(selection.start, selection.end) ===
                            selection.word
                        ) {
                          patch({
                            text:
                              s.text.slice(0, selection.start) +
                              word +
                              s.text.slice(selection.end),
                          });
                          setSelection({ start: 0, end: 0, word: '' });
                        }
                      }}
                    />
                  </div>
                )}
                {p.enabled.includes('world') && (
                  <EntityPanel
                    entities={recognition.entities.filter((e) =>
                      e.sceneIds.includes(s.id),
                    )}
                    error={recognition.error}
                    scanning={recognition.scanning}
                    checkedAt={recognition.checkedAt}
                    rescan={recognition.rescan}
                    project={p}
                    update={update}
                  />
                )}
                <div className="inspector-note">
                  <Feather size={20} />
                  <p>
                    Erst schreiben.
                    <br />
                    Dann feinschleifen.
                  </p>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>
      {structure && (
        <StructureDialog
          key={p.id + structure.kind + structure.id}
          project={p}
          selection={structure}
          close={() => setStructure(null)}
          apply={(action) => {
            const next = changeStructure(library, action);
            setLibrary(next);
            const scenes = next.projects.find(
              (x) => x.id === next.active,
            )!.scenes;
            setView('write');
            if (action.type === 'newChapter')
              setSelected(
                scenes.find((s) => s.chapter === action.chapter.trim())!.id,
              );
            else if (action.type === 'move' || action.type === 'promote')
              setSelected(action.sceneId);
            else if (!scenes.some((x) => x.id === selected))
              setSelected(scenes[0].id);
            setNotice(
              'Kapitelstruktur geändert. Der vorherige Stand ist als Version gesichert.',
            );
          }}
        />
      )}
      <ProjectDialog
        open={projectDialog}
        setOpen={setProjectDialog}
        library={library}
        setLibrary={setLibrary}
        project={p}
        update={update}
        select={(id) => {
          setSelected(id);
          setView('write');
        }}
        error={saveError}
      />
      <Dialog open={versionDialog} onOpenChange={setVersionDialog}>
        <DialogContent className="project-dialog">
          <DialogTitle>Deine Überarbeitungen</DialogTitle>
          <DialogDescription>
            Benannte Stände sichern und frühere Fassungen vergleichen.
          </DialogDescription>
          <Versions
            library={library}
            setLibrary={setLibrary}
            project={p}
            select={setSelected}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="settings-dialog">
          <DialogTitle>Dein Atelier, deine Werkzeuge.</DialogTitle>
          <DialogDescription>
            Aktiviere die Module, die du für dieses Buch brauchst. Deine Inhalte
            bleiben beim Abschalten erhalten.
          </DialogDescription>
          {modules
            .filter((m) => !m.core)
            .map((m) => (
              <div className="module-toggle" key={m.id}>
                <span>
                  <strong>{m.label}</strong>
                  <small>{m.description}</small>
                </span>
                <Switch
                  checked={p.enabled.includes(m.id)}
                  onCheckedChange={(checked) => {
                    update((p) => ({
                      ...p,
                      enabled: checked
                        ? [...p.enabled, m.id]
                        : p.enabled.filter((id) => id !== m.id),
                    }));
                    if (!checked && view === m.id) setView('write');
                  }}
                  aria-label={m.label}
                />
              </div>
            ))}
          <div className="install-help">
            <strong>Auf deinen Homescreen</strong>
            <p>
              Auf iPhone und iPad in Safari: Teilen → Zum Home-Bildschirm → Als
              Web-App öffnen. Nach dem ersten vollständigen Laden kannst du
              offline schreiben.
            </p>
            <p>
              Projekte bleiben auf diesem Gerät. Über „Projekte & Export“ kannst
              du Sicherungen auf andere Geräte übertragen.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      {notice && <output className="toast">{notice}</output>}
    </SidebarProvider>
  );
}
function Navigation({
  view,
  go,
  enabled,
}: {
  view: string;
  go: (s: string) => void;
  enabled: string[];
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <nav className="module-nav" aria-label="Werkzeuge">
      {modules
        .filter((m) => m.core || enabled.includes(m.id))
        .map((m) => (
          <button
            className={view === m.id ? 'nav-active' : ''}
            key={m.id}
            onClick={() => {
              go(m.id);
              setOpenMobile(false);
            }}
          >
            <m.icon size={19} />
            <span>{m.label}</span>
            {view === m.id && <span className="nav-indicator" />}
          </button>
        ))}
    </nav>
  );
}
function Findings({
  findings,
  select,
}: {
  findings: ReturnType<typeof analyze>;
  select: (a: number, b: number) => void;
}) {
  return (
    <>
      <p className="muted small">
        {findings.length} Hinweise · Regelbasierte Schreibhilfe, kein
        Korrektorat.
      </p>
      {findings.length === 0 ? (
        <div className="empty-analysis">
          <Check size={22} />
          <strong>Freie Bahn für deine Worte.</strong>
          <p>Keine Auffälligkeiten nach den aktiven Stilregeln.</p>
        </div>
      ) : (
        findings.slice(0, 80).map((f, i) => (
          <button
            className="finding"
            key={i}
            onClick={() => select(f.start, f.end)}
          >
            <small>{f.kind}</small>
            <span>{f.message}</span>
          </button>
        ))
      )}
    </>
  );
}
