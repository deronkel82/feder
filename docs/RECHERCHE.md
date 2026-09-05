# Papyrus: Funktionsrecherche und Umsetzung in Feder

Stand: 5. September 2026. Unabhängige Implementierung. Kein Papyrus-Code, keine Produktgrafiken und keine proprietären Wörterbücher übernommen.

Papyrus zeichnet sich durch die Verbindung von Schreiben, struktureller Planung, Romanwissen und Überarbeitung in einer Arbeitsumgebung aus.

| Bereich | Kennzeichnende Papyrus-Funktion | Feder 0.1 |
| --- | --- | --- |
| Manuskript | Navigator mit Kapiteln und Szenen, Umordnen und Status | Szenennavigation, Suche über Titel/Kapitel/Text, Kapitelzuordnung, Status, Umordnen, Fokusmodus |
| Planung | Organizer und Denkbrett für Handlung und Ideen | Ideenwand mit drei Entwicklungsstufen, editierbare Karten; keine freie graphische Mindmap |
| Weltwissen | Storykarten für Figuren, Orte und Hintergrund | Figuren- und Ortskarten, Perspektive an Szenen |
| Zeit | Zeitstrahl für Kapitel, Szenen und Ereignisse | Datierte Szenen, chronologisch sortierte Ansicht; keine relativen Abhängigkeiten |
| Sprache | Stilanalyse, Wiederholungen, lange Sätze, Lesbarkeit | Heuristische Hinweise mit Sprung zur Textstelle: Füllwörter, Sätze über 28 Wörter, wiederholte Wörter ab fünf Buchstaben innerhalb von 180 Zeichen |
| Wörterbuch | Sprachliche Hilfen im Schreibprozess | Vollständiger lokaler OpenThesaurus-Textdatenbestand für Synonyme, separat Browser-Rechtschreibung |
| Recherche | Quellen und Recherchematerial neben dem Text | Recherchekarten mit Quellenfeld und Notizen |
| Überarbeiten | Änderungsverfolgung, Zusammenarbeit mit Word | Manuelle Projektversionen und Wiederherstellung; keine Word-Änderungsverfolgung |
| Publizieren | Export und professionelle Buchausgabe | Markdown, EPUB 3, Druck/PDF über Browser; keine DOCX-Importtreue, kein professioneller Buchsatz |
| Projekte | Bücher und Fortschritt verwalten | Mehrere Projekte, Wortziel, lokale Speicherung, JSON-Sicherungen und Import |

## Primärquellen

- Plotten, Organizer, Navigator, Timeline: https://papyrus.de/features/plotting
- Denkbrett und Umwandlung von Ideen in Kapitel: https://support.papyrus.de/wiki/das-denkbrett/
- Stilanalyse, Lesbarkeit, Dialogfokus, Änderungsverfolgung: https://papyrus.de/features/style-analysis
- Storykarten: https://papyrus.de/features/story-sheets
- Publizieren: https://papyrus.de/features/publishing
- Überblick Papyrus 12: https://papyrus.de/
- OpenThesaurus Daten und Lizenz: https://www.openthesaurus.de/about/download
- OpenThesaurus API-Bedingungen: https://www.openthesaurus.de/about/api

OpenThesaurus ist ein Synonymwörterbuch, **kein Ersatz für Rechtschreib- oder Grammatikprüfung**. Feder verwendet den heruntergeladenen, lokal verarbeiteten Datenbestand. Dadurch sind keine API-Anfragen, kein API-Proxy und keine laufende Übermittlung von Suchwörtern erforderlich. Browser-Rechtschreibung hängt vom verwendeten Browser und dessen Spracheinstellungen ab.

## Weitere mögliche Ausbaustufen

Rich-Text-Editor mit DOCX-Import; echtes Änderungsprotokoll mit Kommentaren; freie Mindmap mit Beziehungen; relative Zeitachsen; LanguageTool als optionales selbst betriebenes Grammatikmodul; geräteübergreifende Synchronisierung mit Konfliktauflösung; differenzielle Versionierung und automatisierte Gerätematrix für Safari/iOS.
