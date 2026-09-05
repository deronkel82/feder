# Architektur

Feder ist eine statisch ausgelieferte React/TypeScript-PWA. Kein Backend, keine Tracker, keine Authentifizierung. Manuskripte werden in IndexedDB gespeichert, nie im GitHub-Repository.

- `src/core/model.ts`: versioniertes Datenschema, Validierung, Projekt-/Szenenfabriken und Wortzählung.
- `src/core/storage.ts`: IndexedDB-Repository, serieller Schreibzugriff und Versionsprüfung gegen parallele Fenster. Der Status „gespeichert“ wird erst nach erfolgreicher Transaktion gezeigt. Bestehende lokale V1-Daten werden eingelesen.
- `src/modules/registry.ts`: Modulkatalog und Aktivierung pro Projekt.
- `src/modules/planning.tsx`: Karten, Romanwelt und Timeline.
- `src/modules/analysis.ts`: pure, unabhängig testbare Regeln mit Textpositionen.
- `src/modules/thesaurus.tsx`: lokal geladenes, austauschbares Wörterbuch. Laden erst bei erster Suche; PWA-Cache hält Daten offline bereit.
- `src/modules/publishing.ts`: HTML-escaping, EPUB-3-ZIP und Druckansicht.
- `src/modules/projects.tsx`: Bücher, Sicherungen und Versionen.
- `src/App.tsx`: Anwendungsshell, Editor und gemeinsam genutzter Projektzustand.
- `components/ui/`: mitgelieferte zugängliche Base-UI-/Shadcn-Primitiven für Navigation, Dialoge, Tabs, Auswahl und Schalter.

## Neues Modul

1. Neue Komponente unter `src/modules/` anlegen. Über `project` und `update(project => nextProject)` arbeiten; nicht direkt in die Datenbank schreiben.
2. Eindeutige ID, Icon, Namen und Beschreibung in `registry.ts` ergänzen.
3. Die Ansicht am Modul-Outlet in `App.tsx` anbinden. Navigation und Modulschalter folgen automatisch dem Katalog.
4. Neue dauerhafte Daten versionieren und Validator/Import anpassen. Für neue Analyse-Regeln genügt eine zusätzliche Funktion mit `Finding`-Ausgabe.
5. Tests für Datenverlust, Migrationen und Exporte ergänzen. `npm run build` aktualisiert die Liste gecachter Dateien automatisch.

## Datensicherung und Konkurrenz

Jeder Schreibvorgang erhält die erwartete Datenbankrevision. Andere Fenster mit veralteter Revision werden am Überschreiben gehindert. Export bleibt dann möglich; nach Sicherung neu laden. Bis zu 50 vollständige Snapshots werden gehalten. Große Archive benötigen entsprechend Gerätespeicher; Fehler werden sichtbar angezeigt. Die App fordert bei ungesicherten Änderungen einen Browserhinweis vor dem Verlassen an, soweit die Plattform dies unterstützt.

## Veröffentlichen

GitHub Pages wird aus `main` und `/docs` ausgeliefert. Die fertige Web-App liegt deshalb nach `npm run build` zusätzlich unter `docs/` (durch `npm run release:pages`). Forschungs- und Architekturdokumente bleiben ebenfalls dort. Keine serverseitigen Secrets oder API-Bindungen erforderlich.

`release:pages` kopiert einen abgeschlossenen Build nach `docs/`, entfernt ausschließlich veraltete generierte Assets, bewahrt Markdown-Dokumentation und legt `.nojekyll` an. Das Release wird geprüft und als normaler Commit veröffentlicht. Alternativ lässt sich `dist-pages/` auf jedem statischen HTTPS-Host veröffentlichen.
