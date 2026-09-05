import type { ChapterMeta } from '../core/chapters';
export function ChapterFields({
  value,
  change,
  parts,
}: {
  value: ChapterMeta;
  change: (c: ChapterMeta) => void;
  parts: string[];
}) {
  return (
    <>
      <label className="field-label">
        KAPITELART
        <select
          value={value.kind}
          onChange={(e) =>
            change({
              ...value,
              kind: e.target.value as ChapterMeta['kind'],
              number: e.target.value === 'chapter' ? value.number : '',
              part: e.target.value === 'chapter' ? value.part : '',
            })
          }
        >
          <option value="chapter">Kapitel</option>
          <option value="prologue">Prolog (ohne Nummer)</option>
          <option value="epilogue">Epilog (ohne Nummer)</option>
        </select>
      </label>
      {value.kind === 'chapter' && (
        <label className="field-label">
          NUMMER
          <input
            value={value.number}
            onChange={(e) => change({ ...value, number: e.target.value })}
            placeholder="z. B. 3 oder III"
          />
        </label>
      )}
      {value.kind === 'chapter' && (
        <>
          <label className="field-label">
            TEIL / AKT
            <input
              value={value.part}
              onChange={(e) => change({ ...value, part: e.target.value })}
              placeholder="z. B. Akt I – Die Ankunft; leer = ohne Gruppe"
            />
          </label>
          {parts.length > 0 && (
            <div className="part-options">
              {parts.map((part) => (
                <button
                  key={part}
                  type="button"
                  onClick={() => change({ ...value, part })}
                >
                  {part}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {value.kind !== 'chapter' && (
        <p className="muted small">
          Prolog und Epilog stehen ohne Kapitelnummer vor beziehungsweise nach
          den Teilen des Buchs.
        </p>
      )}
    </>
  );
}
