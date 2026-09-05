# Feder · Schreibatelier

Eine unabhängige Open-Source-Schreib-App für Geschichten, Figuren und Ideen. Inspiriert von den Arbeitsabläufen spezialisierter Autorensoftware. Für Web, iPad und iPhone; als PWA auf dem Homescreen und nach vollständigem Erstladen auch offline nutzbar.

**App:** https://deronkel82.github.io/feder/

## Was funktioniert

- Mehrere Buchprojekte mit Kapiteln, Szenen, Volltextsuche in der Navigation und Wortziel.
- Schreibfläche mit nativer Rechtschreibprüfung, Markdown-Markierungen für fett/kursiv, Fokusmodus, hell/dunkel.
- Szenenstatus, Zusammenfassung, Perspektive, Datum, Notizen und Umordnen.
- Ideenwand, Figuren, Orte, Recherchekarten und chronologischer Zeitstrahl.
- Stilanalyse: Füllwörter, lange Sätze und Wiederholungen; Klick markiert die Textstelle.
- **48.479 OpenThesaurus-Synonymgruppen lokal**, ohne API oder Übertragung von Texten. Markiertes Wort durch Synonym ersetzen.
- Lokale IndexedDB-Speicherung, sichtbarer Speicherstatus, Schutz vor Überschreiben durch ein anderes Fenster.
- Versionssicherungen und Wiederherstellung; Entfernen von Szenen mit vorheriger Sicherung.
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

Die App in Safari öffnen. Teilen → Zum Home-Bildschirm → „Als Web-App öffnen“ aktivieren (sofern angeboten) → Hinzufügen. Das erste Laden muss online erfolgen. Der Service Worker speichert auch die komplette Wortdatenbank lokal. Updates werden nach Schließen aller offenen Feder-Fenster beim nächsten Start aktiv.

**Speicher ist geräte- und browsergebunden.** Es gibt keine automatische Synchronisierung. JSON-Sicherungen regelmäßig herunterladen und über Dateien/iCloud/AirDrop auf andere Geräte übertragen und dort importieren. Browserdaten zu löschen oder Speicherbereinigung durch das Betriebssystem kann lokale Projekte entfernen. „Lokal gespeichert“ bedeutet keine externe Sicherung. Ein Import legt zusätzliche Projekte an und erhält bis zu 50 Versionen insgesamt.

## Modular erweitern

Siehe [Architektur](docs/ARCHITEKTUR.md) und [Funktionsrecherche](docs/RECHERCHE.md). Neue Werkzeuge können die Projektstruktur verwenden und eigene Ansichten registrieren. Bewusst kein Ausführen beliebiger aus dem Web heruntergeladener Plug-ins.

## Grenzen dieser ersten Version

Keine vollständige Papyrus-Funktionsparität: keine Duden-Grammatikprüfung, kein DOCX-Roundtrip, keine Änderungsverfolgung, keine Cloud-Synchronisierung, keine freie Mindmap und kein professioneller Buchsatz. Die Schreibfläche editiert einfachen Text und Markdown; fett/kursiv wird beim EPUB-/Druckexport umgesetzt. Stilanalyse ist eine Heuristik, keine Qualitätsbewertung. OpenThesaurus bietet Synonyme, keine Grammatikprüfung. Physische iOS-/iPadOS-Geräte wurden in dieser Sitzung nicht getestet.

## Lizenz

App-Code: [MIT](LICENSE). OpenThesaurus-Daten: **LGPL 2.1 oder später**, siehe [Drittanbieterhinweise](THIRD_PARTY.md). Feder steht in keiner Verbindung zu Papyrus oder dessen Herstellern.
