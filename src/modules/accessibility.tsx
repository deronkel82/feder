import type { Accessibility } from '../core/accessibility';
export function AccessibilityFields({
  value,
  change,
}: {
  value: Accessibility;
  change: (v: Accessibility) => void;
}) {
  return (
    <section className="accessibility-fields">
      <h3>Lesen & Bedienen</h3>
      <div className="review-fields">
        <label>
          Textgröße
          <select
            value={value.fontSize}
            onChange={(e) =>
              change({ ...value, fontSize: Number(e.target.value) })
            }
          >
            {[18, 21, 24, 28].map((n) => (
              <option key={n} value={n}>
                {n} px
              </option>
            ))}
          </select>
        </label>
        <label>
          Zeilenabstand
          <select
            value={value.lineHeight}
            onChange={(e) =>
              change({ ...value, lineHeight: Number(e.target.value) })
            }
          >
            {[1.5, 1.8, 2.1].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Schrift
          <select
            value={value.font}
            onChange={(e) =>
              change({
                ...value,
                font: e.target.value as Accessibility['font'],
              })
            }
          >
            <option value="serif">Literarisch (Serifen)</option>
            <option value="sans">Klar (ohne Serifen)</option>
          </select>
        </label>
      </div>
      <label>
        <input
          type="checkbox"
          checked={value.largeTargets}
          onChange={(e) => change({ ...value, largeTargets: e.target.checked })}
        />
        Große Bedienelemente
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.reducedMotion}
          onChange={(e) =>
            change({ ...value, reducedMotion: e.target.checked })
          }
        />
        Animationen reduzieren
      </label>
      <p className="muted small">
        Auf Touchgeräten werden Schaltflächen automatisch vergrößert. Mit
        externer Tastatur: Strg/⌘ + Umschalt + F für Suchen & Ersetzen, + M für
        Kommentare und + S für eine neue Version. Die Kürzel gelten außerhalb
        geöffneter Dialoge.
      </p>
    </section>
  );
}
