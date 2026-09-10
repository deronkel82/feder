import { useState } from 'react';
import type { Project, Library } from '../core/model';
import {
  hasOwnAuthor,
  setAuthorOverride,
  setDefaultAuthor,
} from '../core/authors';
export function AuthorFields({
  project,
  defaultAuthor,
  update,
}: {
  project: Project;
  defaultAuthor: string;
  update: (fn: (p: Project) => Project) => void;
}) {
  const own = hasOwnAuthor(project);
  return (
    <div className="author-fields">
      <label className="format-check">
        <input
          type="checkbox"
          checked={own}
          onChange={(e) =>
            update((p) => setAuthorOverride(p, e.target.checked, defaultAuthor))
          }
        />
        Abweichenden Autor für dieses Projekt verwenden
      </label>
      <label className="field-label">
        AUTOR / AUTORIN
        <input
          disabled={!own}
          value={project.author}
          placeholder={
            own
              ? 'Autor / Autorin'
              : 'Standard-Autor in den Einstellungen festlegen'
          }
          onChange={(e) => update((p) => ({ ...p, author: e.target.value }))}
        />
      </label>
      {!own && (
        <p className="muted small">
          Übernimmt den Standard-Autor aus den Einstellungen.
        </p>
      )}
    </div>
  );
}
export function DefaultAuthorSettings({
  library,
  setLibrary,
  disabled,
}: {
  library: Library;
  setLibrary: React.Dispatch<React.SetStateAction<Library>>;
  disabled: boolean;
}) {
  const [author, setAuthor] = useState(library.defaultAuthor || '');
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="default-author-settings"
      onSubmit={(e) => {
        e.preventDefault();
        setLibrary((l) => setDefaultAuthor(l, author));
        setSaved(true);
      }}
    >
      <label className="field-label">
        STANDARD-AUTOR / AUTORIN
        <input
          value={author}
          onChange={(e) => {
            setAuthor(e.target.value);
            setSaved(false);
          }}
          placeholder="Dein Name oder Pseudonym"
        />
      </label>
      <p className="muted small">
        Gilt für neue Projekte und Projekte ohne abweichenden Autor. Bereits
        vorhandene Autorenangaben bleiben als individuelle Angaben erhalten. Die
        Einstellung wird lokal und in der kompletten Sicherung gespeichert.
      </p>
      <button className="text-button" disabled={disabled} type="submit">
        Standard-Autor speichern
      </button>
      {saved && (
        <output className="muted small">Standard-Autor übernommen.</output>
      )}
    </form>
  );
}
