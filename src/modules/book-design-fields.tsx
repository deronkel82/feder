import { useState } from 'react';
import type { Project } from '../core/model';
import type { ExportOptions } from '../core/workbench';
import { bookDesignDefaults } from '../core/book-design';
import { readCover } from './cover-image';
export function BookDesignFields({
  project,
  options,
  change,
}: {
  project: Project;
  options: ExportOptions;
  change: (
    o: ExportOptions | ((current: ExportOptions) => ExportOptions),
  ) => void;
}) {
  const o = { ...bookDesignDefaults, ...options };
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const check = (key: keyof typeof bookDesignDefaults, label: string) => (
    <label className="format-check" key={key}>
      <input
        type="checkbox"
        checked={Boolean(o[key])}
        onChange={(e) => change({ ...o, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  const text = (
    key: 'imprint' | 'dedication' | 'header' | 'footer',
    label: string,
    rows = 3,
  ) => (
    <label className="field-label">
      {label}
      <textarea
        rows={rows}
        value={o[key]}
        onChange={(e) => change({ ...o, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <>
      <details className="export-section">
        <summary>Seitenränder · Druck & PDF</summary>
        <p className="muted small">
          Abstand zwischen Blattrand und Text in Millimetern (A4). Oben und
          unten bestimmen den freien Platz über und unter dem Manuskript.
        </p>
        <div className="print-margin-fields">
          {(
            ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'] as const
          ).map((key, i) => (
            <label className="field-label" key={key}>
              {['Oben (mm)', 'Unten (mm)', 'Links (mm)', 'Rechts (mm)'][i]}
              <input
                type="number"
                min={5}
                max={50}
                value={o[key]}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n) && n >= 5 && n <= 50)
                    change({ ...o, [key]: n });
                }}
              />
            </label>
          ))}
        </div>
        <p className="muted small">
          Für Kopf- und Fußzeilen mindestens 15 mm oben bzw. unten vorsehen. Im
          Druckdialog A4 und 100 % Skalierung wählen; die Druckvorschau zeigt
          die endgültigen Seitenränder.
        </p>
        <button
          type="button"
          onClick={() =>
            change({
              ...o,
              marginTop: 25,
              marginBottom: 25,
              marginLeft: 25,
              marginRight: 25,
            })
          }
        >
          Standardränder (25 mm)
        </button>
      </details>
      <details className="export-section" open>
        <summary>Buchanfang</summary>
        <label className="field-label">
          Cover
          <select
            value={o.coverMode}
            onChange={(e) =>
              change({
                ...o,
                coverMode: e.target.value as ExportOptions['coverMode'],
              })
            }
          >
            <option value="none">Kein Cover</option>
            <option value="project">Projektcover verwenden</option>
            <option value="alternative">Alternatives Cover</option>
          </select>
        </label>
        {o.coverMode === 'project' && !project.cover && (
          <p className="muted small">
            Das Projekt hat noch kein Cover. Füge es in der Projektverwaltung
            hinzu.
          </p>
        )}
        {o.coverMode === 'alternative' && (
          <>
            <label className="field-label">
              Alternatives Exportcover (JPG, PNG, WebP · bis 20 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setBusy(true);
                  try {
                    const cover = await readCover(file);
                    change((current) => ({
                      ...current,
                      alternativeCover: cover,
                    }));
                    setMessage('Alternatives Cover gespeichert.');
                  } catch (e) {
                    setMessage((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            {o.alternativeCover && (
              <button
                type="button"
                onClick={() => change({ ...o, alternativeCover: undefined })}
              >
                Alternatives Cover entfernen
              </button>
            )}
            <output>{busy ? 'Bild wird vorbereitet …' : message}</output>
          </>
        )}
        <label className="format-check">
          <input
            type="checkbox"
            checked={o.titlePage}
            onChange={(e) => change({ ...o, titlePage: e.target.checked })}
          />
          Schmutztitel – eigene Titelseite
        </label>
        {o.titlePage && (
          <div className="export-suboptions">
            {check('halfTitleTitle', 'Buchtitel')}
            {check('halfTitleAuthor', 'Autor')}
            {project.series.enabled && (
              <>
                {check('halfTitleSeries', 'Reihenname')}
                {check('halfTitleVolume', 'Bandnummer')}
                {o.halfTitleSeries && (
                  <>
                    <label className="field-label">
                      Größe des Reihennamens (pt)
                      <input
                        type="number"
                        min={8}
                        max={72}
                        value={o.halfTitleSeriesSize}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (Number.isFinite(n) && n >= 8 && n <= 72)
                            change({ ...o, halfTitleSeriesSize: n });
                        }}
                      />
                    </label>
                    <label className="field-label">
                      Position des Reihennamens
                      <select
                        value={o.halfTitleSeriesPosition}
                        onChange={(e) =>
                          change({
                            ...o,
                            halfTitleSeriesPosition: e.target.value as
                              | 'above'
                              | 'below',
                          })
                        }
                      >
                        <option value="above">Über dem Titelblock</option>
                        <option value="below">Unter dem Titelblock</option>
                      </select>
                    </label>
                    <p className="muted small">
                      Der Titelblock enthält die ausgewählten Angaben zu
                      Buchtitel, Autor und Band.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {check('imprintEnabled', 'Impressum auf eigener Seite')}
        {o.imprintEnabled &&
          text('imprint', 'Impressumtext – unten auf der Seite', 6)}
        {check('dedicationEnabled', 'Widmung auf eigener Seite')}
        {o.dedicationEnabled &&
          text('dedication', 'Widmung – mittig wie ein Titel')}
        {check('contents', 'Inhaltsverzeichnis hinzufügen')}
        <p className="muted small">
          Reihenfolge: Cover, Schmutztitel, Impressum, Widmung,
          Inhaltsverzeichnis, Manuskript. Das Inhaltsverzeichnis verlinkt
          Kapitel; Seitenzahlen werden nicht berechnet.
        </p>
      </details>
      <details className="export-section">
        <summary>Kapitel & Akte</summary>
        {check('prologuePage', 'Prologtitel auf einer eigenen Seite')}
        {check(
          'prologueInChapter',
          'Prologtitel zusätzlich über dem Prologtext',
        )}
        {check('hidePrologue', 'Bezeichnung „Prolog“ ausblenden')}
        {check('hideEpilogue', 'Bezeichnung „Epilog“ ausblenden')}
        {check('partPage', 'Akttitel auf einer eigenen Seite')}
        {check(
          'partInChapter',
          'Akttitel zusätzlich in jeder Kapitelüberschrift',
        )}
        <p className="muted small">
          Der Prologtitel stammt aus dem Kapitelnamen. Ausgeblendete
          Bezeichnungen erzeugen keine leere Titelseite. Eigene Szenentitel
          bleiben erhalten. Aktnamen legst du beim Bearbeiten der Kapitel fest.
        </p>
      </details>
      <details className="export-section">
        <summary>Kopf- & Fußzeile</summary>
        {text('header', 'Kopfzeile', 2)}
        {text('footer', 'Fußzeile', 2)}
        <p className="muted small">
          Kurze Texte verwenden. Im Druck werden die Zeilen wiederholt; die
          eigenen Kopf-/Fußzeilen des Browsers im Druckdialog ausschalten.
          EPUB-Lesegeräte gestalten diese Bereiche selbst.
        </p>
      </details>
    </>
  );
}
