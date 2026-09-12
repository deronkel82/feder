import { BookDesignFields } from './book-design-fields';
import { bookDesignDefaults } from '../core/book-design';
import { useState, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { uid, type Project } from '../core/model';
import { exportDefaults, type ExportOptions } from '../core/workbench';
import { exportDocument, exportEpub, printBook } from './publishing';
import { download, safeName } from '../core/storage';
const builtin = [
  { id: 'reader', name: 'Testleser', options: exportDefaults },
  {
    id: 'norm',
    name: 'Normseiten-Stil',
    options: {
      ...exportDefaults,
      font: 'mono' as const,
      line: 1.5,
      gap: 0,
      sceneHeadings: false,
    },
  },
  {
    id: 'contest',
    name: 'Wettbewerb – anonym',
    options: {
      ...exportDefaults,
      font: 'sans' as const,
      line: 1.5,
      titlePage: false,
      anonymous: true,
    },
  },
];
export function ExportPreview({
  project,
  update,
  disabled,
}: {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [options, setOptionsState] = useState<ExportOptions>(() => ({
      ...bookDesignDefaults,
      ...(project.exportOptions || exportDefaults),
    })),
    [name, setName] = useState(''),
    [message, setMessage] = useState('');
  const optionsRef = useRef(options);
  const setOptions = (
    next: ExportOptions | ((current: ExportOptions) => ExportOptions),
  ) => {
    if (disabled) return;
    const normalized = {
      ...bookDesignDefaults,
      ...(typeof next === 'function' ? next(optionsRef.current) : next),
    };
    optionsRef.current = normalized;
    setOptionsState(normalized);
    update((p) => ({ ...p, exportOptions: normalized }));
  };
  const html = useMemo(
    () => exportDocument(project, options),
    [project, options],
  );
  return (
    <>
      <button onClick={() => setOpen(true)}>
        <span>
          Exportvorschau & Vorlagen
          <small>Layout prüfen · Druck/PDF, EPUB oder HTML</small>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="project-dialog export-preview">
          <DialogTitle>Export · {project.title}</DialogTitle>
          <DialogDescription>
            Lege das Layout fest und prüfe den Inhalt vor der Ausgabe. Deine
            Einstellungen und Vorlagen werden im Projekt gespeichert und mit
            synchronisiert.
          </DialogDescription>
          <div className="export-layout">
            <section>
              <fieldset disabled={disabled}>
                <label className="field-label">
                  Vorlage anwenden
                  <select
                    value=""
                    onChange={(e) => {
                      const p = [
                        ...builtin,
                        ...(project.exportPresets || []),
                      ].find((p) => p.id === e.target.value);
                      if (p) setOptions(p.options);
                    }}
                  >
                    <option value="">Vorlage auswählen …</option>
                    {[...builtin, ...(project.exportPresets || [])].map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <BookDesignFields
                  project={project}
                  options={options}
                  change={setOptions}
                />
                <details className="export-section">
                  <summary>Schrift & Seitenlayout</summary>
                  <label className="field-label">
                    Schrift
                    <select
                      value={options.font}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          font: e.target.value as ExportOptions['font'],
                        })
                      }
                    >
                      <option value="serif">Serifenschrift</option>
                      <option value="sans">Serifenlos</option>
                      <option value="mono">Schreibmaschinenschrift</option>
                    </select>
                  </label>
                  {[
                    ['size', 'Schriftgröße (pt)', 8, 24, 1],
                    ['line', 'Zeilenabstand', 1, 3, 0.1],
                    ['gap', 'Absatzabstand (pt)', 0, 30, 1],
                  ].map(([key, label, min, max, step]) => (
                    <label className="field-label" key={key}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={options[key as 'size' | 'line' | 'gap']}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (
                            Number.isFinite(n) &&
                            n >= Number(min) &&
                            n <= Number(max)
                          )
                            setOptions({ ...options, [key]: n });
                        }}
                      />
                    </label>
                  ))}
                  {[
                    ['chapterBreak', 'Neues Kapitel auf neuer Seite'],
                    ['sceneHeadings', 'Szenentitel anzeigen'],
                    ['anonymous', 'Autor ausblenden'],
                  ].map(([key, label]) => (
                    <label className="format-check" key={key}>
                      <input
                        type="checkbox"
                        checked={
                          options[
                            key as
                              | 'chapterBreak'
                              | 'sceneHeadings'
                              | 'titlePage'
                              | 'anonymous'
                          ]
                        }
                        onChange={(e) =>
                          setOptions({ ...options, [key]: e.target.checked })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </details>
                <details className="export-section">
                  <summary>Als eigene Vorlage speichern</summary>
                  <input
                    aria-label="Name der Exportvorlage"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name der Vorlage"
                  />
                  <button
                    disabled={disabled || !name.trim()}
                    onClick={() => {
                      update((p) => ({
                        ...p,
                        exportPresets: [
                          ...(p.exportPresets || []),
                          {
                            id: uid(),
                            name: name.trim(),
                            options: { ...options },
                          },
                        ],
                      }));
                      setName('');
                      setMessage('Vorlage gespeichert.');
                    }}
                  >
                    Vorlage speichern
                  </button>
                  {project.exportPresets?.map((p) => (
                    <div className="review-options" key={p.id}>
                      <span>{p.name}</span>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          update((x) => ({
                            ...x,
                            exportPresets: x.exportPresets?.filter(
                              (t) => t.id !== p.id,
                            ),
                          }))
                        }
                      >
                        Vorlage entfernen
                      </button>
                    </div>
                  ))}
                </details>
              </fieldset>
            </section>
            <section>
              <h3>Inhalts- und Layoutvorschau</h3>
              <iframe
                title="Exportvorschau des Manuskripts"
                sandbox=""
                srcDoc={html}
              />
              <p className="muted small">
                Die Vorschau zeigt den Textfluss. Endgültige Seitenumbrüche
                siehst du im Druckdialog. „Normseiten-Stil“ ist eine
                Layoutvorlage, keine garantierte 30×60-Normseitenzählung. Prüfe
                Wettbewerbsvorgaben individuell. EPUB-Lesegeräte bestimmen
                Schrift und Seitenumbrüche teilweise selbst.
              </p>
            </section>
          </div>
          <div className="review-options">
            <button
              className="primary-button"
              onClick={() => printBook(project, options)}
            >
              Drucken / als PDF sichern
            </button>
            <button
              onClick={() => {
                void exportEpub(project, options)
                  .then(() => setMessage('EPUB erstellt.'))
                  .catch(() =>
                    setMessage('EPUB konnte nicht erstellt werden.'),
                  );
              }}
            >
              EPUB herunterladen
            </button>
            <button
              onClick={() =>
                download(html, safeName(project.title) + '.html', 'text/html')
              }
            >
              HTML herunterladen
            </button>
          </div>
          <output>{message}</output>
        </DialogContent>
      </Dialog>
    </>
  );
}
