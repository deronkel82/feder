import type { DriveSync } from './use-drive-sync';
export function SyncPanel({ sync }: { sync: DriveSync }) {
  return (
    <section className="sync-panel">
      <h2>Google Drive</h2>
      <p>
        Verbinde dein eigenes Google-Konto auf jedem Gerät. Feder verwendet
        ausschließlich seinen privaten App-Bereich in deinem Drive; deine
        übrigen Dateien bleiben unberührt. Andere Feder-Nutzer haben keinen
        Zugriff auf deine Bibliothek.
      </p>
      {!sync.configured && (
        <details open={!sync.clientId}>
          <summary>Einmalige App-Einrichtung</summary>
          <p>
            Für die veröffentlichte Feder-App wird einmalig eine gemeinsame
            OAuth-Client-ID eingerichtet. Nutzer melden sich danach nur mit
            ihrem eigenen Google-Konto an. Es wird kein Client-Secret benötigt.
          </p>
          <label className="field-label">
            OAUTH-WEB-CLIENT-ID
            <input
              value={sync.clientId}
              disabled={sync.busy || sync.connecting || !!sync.account}
              onChange={(e) => sync.configure(e.target.value)}
              placeholder="…apps.googleusercontent.com"
            />
          </label>
          <p className="muted small">
            Auf allen Geräten muss dieselbe App-Konfiguration verwendet werden.
          </p>
        </details>
      )}
      <div className="review-options">
        {!sync.ready ? (
          <button
            className="primary-button"
            disabled={!sync.clientId || sync.busy || sync.connecting}
            onClick={() => void sync.prepare()}
          >
            Google-Anmeldung laden
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={
              sync.busy ||
              sync.connecting ||
              !sync.clientId.trim().endsWith('.apps.googleusercontent.com')
            }
            onClick={() => void sync.connect()}
          >
            {sync.account
              ? 'Google-Anmeldung erneuern'
              : 'Mit Google verbinden'}
          </button>
        )}
        {sync.account && (
          <button
            disabled={sync.busy || sync.connecting}
            onClick={sync.disconnect}
          >
            Verbindung trennen
          </button>
        )}
      </div>
      {sync.account && (
        <>
          <p>
            <strong>Verbunden mit {sync.account}</strong>
          </p>
          {sync.initial ? (
            <section className="settings-info">
              <h3>{sync.initial.projects} Projekte in Drive gefunden</h3>
              <p>
                Bei der ersten Verbindung entscheidest du, wie die lokale
                Bibliothek behandelt wird. Der lokale Ausgangsstand wird vor dem
                Übernehmen gesichert. „Ersetzen“ tauscht die gesamte lokale
                Bibliothek gegen den Drive-Stand aus; „Zusammenführen“ behält
                auch lokale Projekte.
              </p>
              <div className="review-options">
                <button
                  disabled={sync.busy || sync.connecting}
                  onClick={() => void sync.synchronize('merge')}
                >
                  Beide Bibliotheken zusammenführen
                </button>
                <button
                  disabled={sync.busy || sync.connecting}
                  onClick={() => void sync.synchronize('download')}
                >
                  Lokale Bibliothek durch Drive ersetzen
                </button>
              </div>
            </section>
          ) : (
            <button
              className="primary-button"
              disabled={sync.busy || sync.connecting}
              onClick={() => void sync.synchronize()}
            >
              Jetzt synchronisieren
            </button>
          )}
          <label className="format-check">
            <input
              type="checkbox"
              disabled={sync.busy || sync.connecting}
              checked={sync.automatic}
              onChange={(e) => sync.auto(e.target.checked)}
            />
            Automatisch bei geöffneter App synchronisieren
          </label>
        </>
      )}
      <p className="muted small">
        Automatik prüft etwa jede Minute, wenn du gerade nicht tippst und kein
        Dialog offen ist. Während des Abgleichs pausiert die Bedienung kurz.
        Nach Ablauf der Google-Anmeldung musst du erneut verbinden. Bei
        geschlossener Homescreen-App läuft kein Hintergrund-Sync.
      </p>
      <p className="muted small">
        Bei gleichzeitigen Änderungen desselben Projekts entstehen
        Konfliktkopien statt stiller Überschreibungen. Löschungen werden beim
        nächsten Abgleich übertragen. Schrift, Farben und andere
        Geräteeinstellungen bleiben lokal.
      </p>
      {sync.lastSync && (
        <p>
          Letzter erfolgreicher Abgleich:{' '}
          {new Date(sync.lastSync).toLocaleString('de')}
        </p>
      )}
      <p className="sync-detail-status">
        Status:{' '}
        {
          {
            offline: 'Offline – Änderungen bleiben lokal.',
            synced: 'Stand abgeglichen.',
            busy: 'Synchronisierung läuft …',
            auth: 'Google-Anmeldung erforderlich.',
            attention: 'Synchronisierung prüfen.',
            pending: 'Lokale Änderungen warten auf den Abgleich.',
          }[sync.status]
        }
      </p>
      <output aria-live="polite">{sync.message}</output>
      <p className="muted small">
        Texte werden über HTTPS an dein Google Drive übertragen, jedoch nicht
        zusätzlich Ende-zu-Ende verschlüsselt. Du kannst Feder den Zugriff
        jederzeit in deinem Google-Konto entziehen.{' '}
        <a href="./privacy.html" target="_blank" rel="noreferrer">
          Datenschutzhinweise
        </a>
      </p>
    </section>
  );
}
