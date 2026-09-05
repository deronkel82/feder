import { useState } from 'react';
import type { Project } from '../core/model';
import {
  formatNames,
  projectFormat,
  isShort,
  usesScenes,
  type ProjectFormat,
} from '../core/project-format';
export function FormatFields({
  format,
  sceneMode,
  change,
}: {
  format: ProjectFormat;
  sceneMode: boolean;
  change: (format: ProjectFormat, sceneMode: boolean) => void;
}) {
  return (
    <>
      <label className="field-label">
        PROJEKTART
        <select
          value={format}
          onChange={(e) => change(e.target.value as ProjectFormat, sceneMode)}
        >
          {Object.entries(formatNames).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {format !== 'short' && (
        <label className="format-check">
          <input
            type="checkbox"
            checked={!sceneMode}
            onChange={(e) => change(format, !e.target.checked)}
          />
          Ein Text pro Kapitel (ohne separate Szenen)
        </label>
      )}
      {format === 'short' && (
        <p className="muted small">
          Ein zusammenhängender Text ohne Kapitel, Reihe oder Bandnummer. Wörter
          und Zeichen können als Wettbewerbsgrenzen eingestellt werden.
        </p>
      )}
    </>
  );
}
export function ProjectModeSettings({
  project,
  apply,
}: {
  project: Project;
  apply: (format: ProjectFormat, sceneMode: boolean) => void;
}) {
  const [format, setFormat] = useState(projectFormat(project));
  const [sceneMode, setSceneMode] = useState(usesScenes(project));
  return (
    <form
      className="project-mode-settings"
      onSubmit={(e) => {
        e.preventDefault();
        apply(format, sceneMode);
      }}
    >
      <FormatFields
        format={format}
        sceneMode={sceneMode}
        change={(f, m) => {
          setFormat(f);
          setSceneMode(m);
        }}
      />
      <p className="muted small">
        Beim Abschalten der Szenen werden ihre Texte je Kapitel zusammengefügt,
        bei Kurzgeschichten zu einem Gesamttext. Vorher wird eine Version
        gesichert. Erneutes Einschalten trennt Texte nicht automatisch wieder
        auf.
      </p>
      <button
        type="submit"
        className="text-button"
        disabled={
          format === projectFormat(project) &&
          (format === 'short' || sceneMode === usesScenes(project))
        }
      >
        Projektart / Textstruktur übernehmen
      </button>
    </form>
  );
}
export function LimitFields({
  project,
  update,
}: {
  project: Project;
  update: (fn: (p: Project) => Project) => void;
}) {
  return (
    <div className="limit-fields">
      {isShort(project) && (
        <label className="format-check">
          <input
            type="checkbox"
            checked={project.wordLimitEnabled !== false}
            onChange={(e) =>
              update((p) => ({ ...p, wordLimitEnabled: e.target.checked }))
            }
          />
          Wortlimit aktiv
        </label>
      )}
      <label className="field-label">
        {isShort(project) ? 'MAXIMALE WÖRTER' : 'WORTZIEL'}
        <input
          type="number"
          min="1"
          max="10000000"
          disabled={isShort(project) && project.wordLimitEnabled === false}
          value={project.target}
          onChange={(e) =>
            update((p) => ({
              ...p,
              target: Math.max(
                1,
                Math.min(10000000, Math.floor(Number(e.target.value)) || 1),
              ),
            }))
          }
        />
      </label>
      <label className="field-label">
        {isShort(project)
          ? 'MAXIMALE ZEICHEN (0 = KEIN LIMIT)'
          : 'ZEICHENZIEL (0 = KEIN ZIEL)'}
        <input
          type="number"
          min="0"
          max="100000000"
          value={project.charTarget || 0}
          onChange={(e) =>
            update((p) => ({
              ...p,
              charTarget: Math.max(
                0,
                Math.min(100000000, Math.floor(Number(e.target.value)) || 0),
              ),
            }))
          }
        />
      </label>
      <p className="muted small">
        Gezählt wird der Manuskripttext, einschließlich Leerzeichen und
        Absatzumbrüchen; ohne Titel, Zusammenfassungen und Notizen. Zwischen
        Textabschnitten zählen zwei Absatzumbrüche. Zeichen werden als
        Unicode-Codepunkte gezählt.
      </p>
    </div>
  );
}
