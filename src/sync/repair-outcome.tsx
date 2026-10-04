import type { RepairResult } from './use-drive-sync';
export function repairOutcomeTitle(result: RepairResult) {
  return result.ok
    ? 'Drive-Sicherung erfolgreich übernommen'
    : 'Drive-Sicherung nicht als erfolgreich bestätigt';
}
export function RepairOutcome({ result }: { result: RepairResult }) {
  return result.ok ? (
    <div>
      <p>
        <strong>Erfolgreich:</strong> Dein lokaler Bestand wurde vollständig
        hochgeladen, unmittelbar aus Drive zurückgelesen und geprüft. Er ist
        jetzt die maßgebliche Drive-Sicherung.
      </p>
      <p>
        {result.projects} Projekte · {result.images} gespeicherte Bilder ·
        abgeschlossen am {new Date(result.date).toLocaleString('de')}
      </p>
      <p>
        Deine lokale Bibliothek und ältere Drive-Sicherungen bleiben erhalten.
        Du kannst Feder jetzt schließen.
      </p>
    </div>
  ) : (
    <div>
      <p>
        <strong>Keine Erfolgsbestätigung:</strong> {result.message}
      </p>
      <p>
        Die lokale Bibliothek bleibt erhalten. Die vorhandene ZIP-Sicherung
        aufbewahren. Falls die abschließende Bestätigung unterbrochen wurde, den
        Drive-Stand im Rettungsbereich prüfen, bevor du erneut reparierst.
      </p>
    </div>
  );
}
