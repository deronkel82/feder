# Architektur

Feder ist eine statisch ausgelieferte React/TypeScript-PWA. Kein Backend, keine Tracker, keine Authentifizierung. Manuskripte werden in IndexedDB gespeichert, nie im GitHub-Repository.

- `src/core/model.ts`: versioniertes Datenschema, Validierung, Projekt-/Szenenfabriken und Wortzählung.
- `src/core/storage.ts`: IndexedDB-Repository, serieller Schreibzugriff und Versionsprüfung gegen parallele Fenster. Der Status „gespeichert“ wird erst nach erfolgreicher Transaktion gezeigt. Bestehende lokale V1-Daten werden mit einer atomaren Originalsicherung nach V2 migriert. Datenbankname, Store und Schlüssel bleiben unverändert.
- `src/modules/registry.ts`: Modulkatalog und Aktivierung pro Projekt.
- `src/modules/planning.tsx`: Karten, Romanwelt und Timeline.
- `src/modules/analysis.ts`: pure, unabhängig testbare Regeln mit Textpositionen.
- `src/modules/thesaurus.tsx`: lokal geladenes, austauschbares Wörterbuch. Laden erst bei erster Suche; PWA-Cache hält Daten offline bereit.
- `src/modules/publishing.ts`: HTML-escaping, EPUB-3-ZIP und Druckansicht.
- `src/core/structure.ts` und `src/modules/structure.tsx`: Kapitelverwaltung auf dem bestehenden Szenenschema; Strukturänderungen mit vorherigem Snapshot. Kapitel sind benannte Gruppen; Namen innerhalb eines Buchs sind eindeutig.
- `src/core/chapters.ts`: optionale Kapitelmetadaten, gemeinsame Nummern-/Gruppenanzeige und Lesereihenfolge für Navigation und Exporte. Prolog/Epilog rahmen die normalen Teile ein.
- `src/core/plotting.ts`: atomare Ideenübernahme mit Snapshot und projektlokaler Szenenverknüpfung, Schutz gegen Duplikate.
- `src/modules/manuscript-tree.tsx`: einklappbare Teile/Kapitel, lokale UI-Präferenzen und Suche auch in Zusammenfassungen.
- `src/core/project-format.ts`: Projektarten, Textstrukturkonvertierung mit Snapshot und Verknüpfungsanpassung, gemeinsame Wort-/Zeichenzählung und Limitberechnung. Ohne Szenenmethodik bleibt intern ein Textelement pro Kapitel; Kurzgeschichten besitzen genau eines.
- `src/modules/project-options.tsx` und `writing-progress.tsx`: Projektauswahl, Ziele/Limits und getrennte Fortschrittsanzeigen.
- `src/core/preferences.ts`: Dark-Mode-Geräteeinstellung, separat von Manuskripten.
- `src/modules/projects.tsx` und `series.tsx`: Bücher, Buchreihen, Import/Export.
- `src/core/history.ts` und `src/modules/versions.tsx`: vollständige nummerierte Snapshots, automatische Überarbeitungsstände, Vergleich und Wiederherstellung.
- `src/modules/entities.ts`, `entities.worker.ts`, `entity-panel.tsx`: austauschbare lokale Erkennungsregeln in einem Web Worker, verzögert nach Texteingaben; bestätigte Vorschläge nutzen normale Romanwelt-Karten.
- `src/modules/updates.tsx` und `scripts/sw-template.txt`: Update-Prüfung, Sicherung, kontrollierte Service-Worker-Aktivierung.
- `src/App.tsx`: Anwendungsshell, Editor und gemeinsam genutzter Projektzustand.
- `components/ui/`: mitgelieferte zugängliche Base-UI-/Shadcn-Primitiven für Navigation, Dialoge, Tabs, Auswahl und Schalter.

## Neues Modul

1. Neue Komponente unter `src/modules/` anlegen. Über `project` und `update(project => nextProject)` arbeiten; nicht direkt in die Datenbank schreiben.
2. Eindeutige ID, Icon, Namen und Beschreibung in `registry.ts` ergänzen.
3. Die Ansicht am Modul-Outlet in `App.tsx` anbinden. Navigation und Modulschalter folgen automatisch dem Katalog.
4. Neue dauerhafte Daten versionieren und Validator/Import anpassen. Für neue Analyse-Regeln genügt eine zusätzliche Funktion mit `Finding`-Ausgabe.
5. Tests für Datenverlust, Migrationen und Exporte ergänzen. `npm run build` aktualisiert die Liste gecachter Dateien automatisch.

## Datensicherung und Konkurrenz

Jeder Schreibvorgang erhält die erwartete Datenbankrevision. Andere Fenster mit veralteter Revision werden am Überschreiben gehindert. Export bleibt dann möglich; nach Sicherung neu laden. Vollständige Snapshots werden ohne automatische Löschung gehalten. Große Archive benötigen entsprechend Gerätespeicher; Fehler werden sichtbar angezeigt. Die App fordert bei ungesicherten Änderungen einen Browserhinweis vor dem Verlassen an, soweit die Plattform dies unterstützt.

## Veröffentlichen

GitHub Pages wird aus `main` und `/docs` ausgeliefert. Die fertige Web-App liegt deshalb nach `npm run build` zusätzlich unter `docs/` (durch `npm run release:pages`). Forschungs- und Architekturdokumente bleiben ebenfalls dort. Keine serverseitigen Secrets oder API-Bindungen erforderlich.

`release:pages` kopiert einen abgeschlossenen Build nach `docs/`, entfernt ausschließlich veraltete generierte Assets, bewahrt Markdown-Dokumentation und legt `.nojekyll` an. Das Release wird geprüft und als normaler Commit veröffentlicht. Alternativ lässt sich `dist-pages/` auf jedem statischen HTTPS-Host veröffentlichen.

## Sichere Updates

App-Cache und Manuskripte liegen getrennt in Cache Storage und IndexedDB. Der Service Worker installiert die nächste Version vollständig, erzwingt während des Schreibens aber keinen Wechsel. Der Update-Knopf sperrt Eingaben, wartet auf die Speichertransaktion und legt eine separate Sicherung an. Der wartende Worker akzeptiert die Aktivierung nur, wenn das anfragende Fenster der einzige offene Client im App-Pfad ist. Erst nach Aktivierung wird neu geladen. Alte Caches bleiben verfügbar, damit alte Clients noch ihre Module laden können.

Bei Schemaänderungen müssen Migration und Sicherung in derselben Transaktion bleiben. Der Schlüssel `feder.library.v1` bezeichnet weiterhin den Speicherplatz; die Daten selbst tragen `version: 2`. V1-Sicherung und letzte Update-Sicherung liegen unter separaten `backup:*`-Schlüsseln. Lokale Kopien schützen vor App-Änderungen, nicht vor dem Löschen des gesamten Browser-Speichers; dafür ist ein heruntergeladener Export erforderlich.

Die Node-Tests prüfen Migration, unbekannte Datenversionen, konkurrierende Fenster, Sicherungen, Versionswiederherstellung, Namensregeln und die Aktivierungsfreigabe des Workers. Sie ersetzen keinen Test auf einem physischen iPad/iPhone.
