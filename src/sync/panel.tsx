import type { DriveSync } from './use-drive-sync';
import { useState } from 'react';
import { TransferStatus } from './transfer-status';
import { imageInventory } from '../core/image-inventory';
export function SyncPanel({ sync }: { sync: DriveSync }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [restoreAcknowledged, setRestoreAcknowledged] = useState(false);
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
              <h3>
                {sync.initial.projects} Projekte in Drive gefunden
                {sync.initial.repaired ? ' · reparierte Bibliothek' : ''}
              </h3>
              <p>
                Bei der ersten Verbindung entscheidest du, wie die lokale
                Bibliothek behandelt wird. Der lokale Ausgangsstand wird vor dem
                Übernehmen gesichert. „Ersetzen“ tauscht die gesamte lokale
                Bibliothek gegen den Drive-Stand aus; „Zusammenführen“ behält
                auch lokale Projekte.
              </p>
              <div className="review-options">
                {!sync.initial.repaired && (
                  <button
                    disabled={sync.busy || sync.connecting}
                    onClick={() => void sync.synchronize('merge')}
                  >
                    Beide Bibliotheken zusammenführen
                  </button>
                )}
                <button
                  disabled={sync.busy || sync.connecting}
                  onClick={() => {
                    setRestoreAcknowledged(false);
                    void sync.prepareRestore();
                  }}
                >
                  Drive-Stand prüfen und auf dieses Gerät übernehmen
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
          <section className="settings-info">
            <h3>Drive-Bibliothek auf dieses Gerät übernehmen</h3>
            <p>
              Für ein iPhone mit Testdaten oder einem alten Sync-Verlauf: Die
              vollständige Drive-Bibliothek wird geprüft und nach Bestätigung
              lokal übernommen. Der bisherige lokale Stand wird vorher als ZIP
              und bei der Übernahme im Browserspeicher gesichert. Dabei wird
              nichts nach Drive hochgeladen. Die Automatik wird pausiert.
            </p>
            {!sync.initial && (
              <button
                disabled={sync.busy || sync.connecting}
                onClick={() => {
                  setRestoreAcknowledged(false);
                  void sync.prepareRestore();
                }}
              >
                Drive-Stand prüfen und auf dieses Gerät übernehmen
              </button>
            )}
            {sync.restoreReady && (
              <>
                <p>
                  <strong>Geprüft, noch nicht übernommen:</strong>{' '}
                  {sync.restoreReady.library.projects.length} Projekte ·{' '}
                  {sync.restoreReady.library.snapshots.length} Versionen ·{' '}
                  {imageInventory(sync.restoreReady.library).unique} Bilder
                </p>
                <ul>
                  {sync.restoreReady.library.projects.map((project) => (
                    <li key={project.id}>{project.title}</li>
                  ))}
                </ul>
                <p>
                  Wenn hier nur Testdaten stehen oder Bücher fehlen, nicht
                  bestätigen. Prüfe das Google-Konto und den Rettungsbereich für
                  ältere Sicherungen.
                </p>
                <label className="format-check">
                  <input
                    type="checkbox"
                    checked={restoreAcknowledged}
                    disabled={sync.busy}
                    onChange={(event) =>
                      setRestoreAcknowledged(event.target.checked)
                    }
                  />
                  Die Projektliste ist richtig. Ich habe die ZIP meines
                  bisherigen lokalen Stands gespeichert. Diese Drive-Bibliothek
                  soll den lokalen Stand ersetzen.
                </label>
                <button
                  className="primary-button"
                  disabled={
                    !restoreAcknowledged || sync.busy || sync.connecting
                  }
                  onClick={() => void sync.confirmRestore()}
                >
                  Geprüfte Drive-Bibliothek jetzt auf diesem Gerät übernehmen
                </button>
              </>
            )}
          </section>
          <details className="settings-info">
            <summary>
              Funktionierenden lokalen Stand als Drive-Sicherung übernehmen
            </summary>
            <p>
              Verwende dies auf dem Gerät mit der vollständigen Bibliothek. Der
              lokale Stand wird vollständig und ohne Zusammenführen als neuer
              Drive-Stand gesichert. Cover und Figurenbilder sind
              eingeschlossen. Schließe Feder auf allen anderen Geräten und
              aktualisiere sie vor dem nächsten Sync.
            </p>
            <button
              disabled={sync.busy || sync.connecting}
              onClick={() => {
                setAcknowledged(false);
                void sync.prepareReplacement();
              }}
            >
              1. Komplette Sicherung mit Bilddateien herunterladen
            </button>
            {sync.replacementReady && (
              <>
                <p>
                  {sync.replacementReady.projects.length} Projekte ·{' '}
                  {sync.replacementReady.snapshots.length} Versionen ·{' '}
                  {imageInventory(sync.replacementReady).unique} eingebettete
                  Bilder (einschließlich historischer Fassungen)
                </p>
                <ul>
                  {sync.replacementReady.projects.map((p) => (
                    <li key={p.id}>{p.title}</li>
                  ))}
                </ul>
                <label className="format-check">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    disabled={sync.busy}
                  />
                  Ich habe die Sicherungsdatei gespeichert und geprüft. Dies ist
                  die vollständige Bibliothek; Feder ist auf allen anderen
                  Geräten geschlossen.
                </label>
                <button
                  className="primary-button"
                  disabled={!acknowledged || sync.busy || sync.connecting}
                  onClick={() => void sync.synchronize('replace')}
                >
                  2. Diesen lokalen Stand als Drive-Sicherung übernehmen
                </button>
                <p className="muted small">
                  Die Automatik bleibt ausgeschaltet. Nach erfolgreicher Prüfung
                  kannst du sie wieder einschalten. Ältere Drive-Stände bleiben
                  zur Rettung erhalten.
                </p>
              </>
            )}
          </details>
        </>
      )}
      <p className="muted small">
        Automatik prüft etwa jede Minute, wenn du gerade nicht tippst und kein
        Dialog offen ist. Während des Abgleichs pausiert die Bedienung kurz.
        Nach Ablauf der Google-Anmeldung musst du erneut verbinden. Bei
        geschlossener Homescreen-App läuft kein Hintergrund-Sync.
      </p>
      <p className="muted small">
        Ab Feder 0.14 werden nur neue oder geänderte Datenblöcke übertragen. Die
        erste Umstellung benötigt einen vollständigen Upload. Bitte Feder auf
        allen Geräten aktualisieren; ältere Versionen können das neue Syncformat
        nicht lesen. Bei einer Unterbrechung bleiben bestätigte Blöcke für den
        nächsten Versuch erhalten.
      </p>
      <p className="muted small">
        Bei gleichzeitigen Änderungen desselben Projekts entstehen
        Konfliktkopien statt stiller Überschreibungen. Löschungen werden beim
        nächsten Abgleich übertragen. Schrift, Farben und andere
        Geräteeinstellungen bleiben lokal.
      </p>
      <p className="muted small">
        Neue Sicherungsstände werden vollständig aus Drive zurückgelesen und
        geprüft, bevor der Abgleich als erfolgreich gilt. Das benötigt
        zusätzliche Downloadzeit. Normale Abgleiche behalten ältere Drive-Stände
        zur Rettung; ausdrücklich dauerhaft gelöschte Projekte werden weiterhin
        berücksichtigt. Geprüfte Sicherungen findest du unter „Projekte &
        Export“.
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
      <TransferStatus progress={sync.transfer} busy={sync.busy} />
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
