# Feder · Schreibatelier

Eine unabhängige Open-Source-Schreib-App für Geschichten, Figuren und Ideen. Inspiriert von den Arbeitsabläufen spezialisierter Autorensoftware. Für Web, iPad und iPhone; als PWA auf dem Homescreen und nach vollständigem Erstladen auch offline nutzbar.

**App:** https://deronkel82.github.io/feder/

## Was funktioniert

- Mehrere Buchprojekte mit Kapiteln, Szenen, Volltextsuche in der Navigation und Wortziel. Optional Buchreihe mit Reihentitel und Band.
- Schreibfläche mit nativer Rechtschreibprüfung, Markdown-Markierungen für fett/kursiv, Fokusmodus, hell/dunkel.
- Szenenstatus, Zusammenfassung, Perspektive, Datum, Notizen und Umordnen.
- Ideenwand, Figuren, Orte, Recherchekarten und chronologischer Zeitstrahl.
- Stilanalyse: Füllwörter, lange Sätze und Wiederholungen; Klick markiert die Textstelle.
- **48.479 OpenThesaurus-Synonymgruppen lokal**, ohne API oder Übertragung von Texten. Markiertes Wort durch Synonym ersetzen.
- Lokale IndexedDB-Speicherung, sichtbarer Speicherstatus, Schutz vor Überschreiben durch ein anderes Fenster.
- Benannte, nummerierte Versionen, Textvergleich und Wiederherstellung mit vorheriger Sicherung. Automatische Ausgangsstände bei Überarbeitung.
- Lokale Personen- und Ortserkennung im Hintergrund: Vorschläge bestätigen, umklassifizieren oder verwerfen. Bekannte Figuren werden auch über eindeutige Vornamen gefunden.
- Automatische Update-Prüfung und „Jetzt aktualisieren“ mit vorherigem Speichern und separater lokaler Sicherung.
- JSON-Sicherung und Import, Markdown/TXT-Import, Markdown- und EPUB-Export, Druck/PDF.
- Abschaltbare Module pro Projekt. Daten bleiben beim Abschalten erhalten.

## Starten

Node.js 22.13+ (für die Tests Node 22.18+ oder 24 empfohlen).

```sh
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run build
```

Der statische Build liegt in `dist-pages/`. Vite nutzt relative Pfade, sodass auch GitHub-Pages-Unterverzeichnisse funktionieren. Es ist kein Server und kein API-Schlüssel erforderlich. Der installierte Sites/Vinext-Starter bleibt als Grundlage erhalten; `vite.pages.config.ts` erzeugt den für GitHub Pages notwendigen reinen Client-Build.

## Homescreen auf iPhone / iPad

Die App in Safari öffnen. Teilen → Zum Home-Bildschirm → „Als Web-App öffnen“ aktivieren (sofern angeboten) → Hinzufügen. Das erste Laden muss online erfolgen. Der Service Worker speichert auch die komplette Wortdatenbank lokal. Neue Versionen werden im Hintergrund gesucht und geladen. „Jetzt aktualisieren“ speichert die Arbeit und eine lokale Update-Sicherung vor dem Neustart. Sind weitere Feder-Fenster geöffnet, wird die Aktivierung abgelehnt. Alternativ werden fertig geladene Updates nach Schließen aller Feder-Fenster beim nächsten Start aktiv.

**Speicher ist geräte- und browsergebunden.** Es gibt keine automatische Synchronisierung. JSON-Sicherungen regelmäßig herunterladen und über Dateien/iCloud/AirDrop auf andere Geräte übertragen und dort importieren. Browserdaten zu löschen oder Speicherbereinigung durch das Betriebssystem kann lokale Projekte entfernen. „Lokal gespeichert“ bedeutet keine externe Sicherung. Ein Import legt zusätzliche Projekte an und übernimmt alle enthaltenen Versionen. Versionsstände werden nicht automatisch gelöscht.

## Neu in 0.2

- **Buchreihe:** Projekte & Export → Neues Buch → Checkbox „Dieses Buch gehört zu einer Buchreihe“. Reihentitel und Band sind auch nachträglich änderbar.
- **Überarbeitungen:** „Version sichern“ öffnet den Versionsbereich. Ein Wechsel des Szenenstatus zu „Überarbeitung“ sichert den bisherigen Buchstand; weitere Textänderungen an überarbeiteten oder fertigen Szenen erzeugen frühestens alle zehn Minuten pro Szene einen zusätzlichen Stand. Wiederherstellen betrifft das gesamte Buch, einschließlich Karten und Reihenangaben. Vorher wird der aktuelle Stand gesichert.
- **Namen:** „Im Text entdeckt“ in der Romanwelt und in der Werkstatt zeigt lokale Vorschläge. Die regelbasierte Erkennung ist keine vollständige sprachwissenschaftliche NER: Sie kann Namen übersehen und Nomen verwechseln. Vorschläge werden erst nach Bestätigung zu Karten. Es wird kein Text übertragen.
- **Datenschema:** V1-Bibliotheken und enthaltene Versionen werden atomar auf V2 umgestellt. Die Originalbibliothek wird zuvor innerhalb derselben IndexedDB-Transaktion gesichert. Bei Fehlern wird die gesamte Umstellung abgebrochen und automatisches Speichern angehalten. Unter Projekte & Export sind Rohdaten und Update-Sicherungen als JSON herunterladbar. Ein normaler Import stellt Sicherungen als zusätzliche Bücher wieder her.

Beim erstmaligen Wechsel von 0.1 auf 0.2 gibt es in der alten Oberfläche noch keinen Update-Knopf. Nach dem Speichern Feder online öffnen, kurz auf das Laden des Updates warten, alle Feder-Fenster und die Homescreen-App schließen und erneut öffnen. Die Versionsanzeige „Feder 0.2“ bestätigt den Wechsel. Browserdaten müssen dafür nicht gelöscht werden.

## Modular erweitern

Siehe [Architektur](docs/ARCHITEKTUR.md) und [Funktionsrecherche](docs/RECHERCHE.md). Neue Werkzeuge können die Projektstruktur verwenden und eigene Ansichten registrieren. Bewusst kein Ausführen beliebiger aus dem Web heruntergeladener Plug-ins.

## Grenzen dieser ersten Version

Keine vollständige Papyrus-Funktionsparität: keine Duden-Grammatikprüfung, kein DOCX-Roundtrip, keine Änderungsverfolgung, keine Cloud-Synchronisierung, keine freie Mindmap und kein professioneller Buchsatz. Die Schreibfläche editiert einfachen Text und Markdown; fett/kursiv wird beim EPUB-/Druckexport umgesetzt. Stilanalyse ist eine Heuristik, keine Qualitätsbewertung. OpenThesaurus bietet Synonyme, keine Grammatikprüfung. Physische iOS-/iPadOS-Geräte wurden in dieser Sitzung nicht getestet.

## Lizenz

App-Code: [MIT](LICENSE). OpenThesaurus-Daten: **LGPL 2.1 oder später**, siehe [Drittanbieterhinweise](THIRD_PARTY.md). Feder steht in keiner Verbindung zu Papyrus oder dessen Herstellern.
