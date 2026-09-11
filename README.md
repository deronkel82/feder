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

**Speicher ist geräte- und browsergebunden.** Eine optionale Synchronisierung über dein eigenes Google Drive lässt sich unter Einstellungen → Sync einschalten. Ohne Verbindung bleibt alles lokal. JSON-Sicherungen regelmäßig herunterladen und über Dateien/iCloud/AirDrop auf andere Geräte übertragen und dort importieren. Browserdaten zu löschen oder Speicherbereinigung durch das Betriebssystem kann lokale Projekte entfernen. „Lokal gespeichert“ bedeutet keine externe Sicherung. Ein Import legt zusätzliche Projekte an und übernimmt alle enthaltenen Versionen. Versionsstände werden nicht automatisch gelöscht.

## Neu in 0.9.1

- Vollständige Lizenz- und Urheberhinweise unter Einstellungen → App & Daten → Lizenzen & Quellen. Auch direkt beim Thesaurus verlinkt und nach vollständigem Laden offline verfügbar.
- Automatisch aus den eingebundenen Paketen erzeugte Drittanbietertexte und Versionsliste bei jedem Build; neue Pakete ohne Lizenzdatei halten die Veröffentlichung an.

## Neu in 0.9.0

- **Google Drive:** Eigenes Konto auf jedem Gerät verbinden, dann „Jetzt synchronisieren“. Auf einem neuen Gerät kann die Drive-Bibliothek übernommen oder mit lokalen Projekten zusammengeführt werden. Automatik prüft bei geöffneter App etwa jede Minute nach einer Eingabepause. Google-Anmeldungen sind zeitlich begrenzt und müssen gelegentlich erneuert werden; kein Hintergrund-Sync bei geschlossener PWA.
- **Datenerhalt:** Dreiseitiger Vergleich mit dem letzten erfolgreichen Abgleich. Gleichzeitige Änderungen desselben Projekts oder derselben Romanwelt erzeugen Konfliktkopien. Vor lokalen Übernahmen wird eine Sicherung erstellt; Abgleichstand und lokale Bibliothek werden atomar gespeichert. Unveränderliche Drive-Stände verhindern gegenseitiges Überschreiben bei parallelen Uploads. Abgelöste Stände werden nach Erfolg entfernt; Fehler werden angezeigt und die Bereinigung erneut versucht.
- **Umfang:** Ganze Bibliothek einschließlich Cover, Versionen, Kommentare, Papierkorb, Vorlagen, Romanwelten und Standard-Autor. Erscheinungsbild und Bedienung bleiben gerätespezifisch. Maximal 100 MB pro Syncstand. Bei Konflikten auf verschiedenen Geräten kann manuell geprüftes Zusammenführen nötig sein; kein gemeinsames Live-Schreiben.
- **Google-App einrichten (nur Betreiber):** Google Drive API aktivieren, OAuth-Zielgruppe „Extern“, Web-Client mit autorisiertem JavaScript-Ursprung `https://deronkel82.github.io` erstellen. Nur `https://www.googleapis.com/auth/drive.appdata` verwenden. Die öffentliche Client-ID in `src/sync/config.ts` eintragen. Niemals ein Client-Secret in diese statische App aufnehmen. Für eigene Deployments einen eigenen Client und passenden Ursprung verwenden. Zum Freischalten anderer Konten muss die Google-App veröffentlicht sein; im Testmodus sind nur eingetragene Testnutzer zugelassen. Nutzer von Feder brauchen kein eigenes Cloud-Projekt.
- **Datenschutz:** [Hinweise zur Drive-Synchronisierung](https://deronkel82.github.io/feder/privacy.html). Zugangstokens nur im Arbeitsspeicher. Datenübertragung direkt zu Google, keine zusätzliche Ende-zu-Ende-Verschlüsselung.

## Neu in 0.8.0

- **Versionsvergleich:** Gesicherten Stand mit dem aktuellen Manuskript oder einer anderen Version vergleichen. Ergänzungen sind unterstrichen, Entfernungen durchgestrichen. Neue und entfernte Textabschnitte werden mit angezeigt. Sehr große Änderungen werden abschnittsweise markiert.
- **Suchen & Ersetzen:** Im Manuskript über „Suchen“. Literale Suche mit optionaler Groß-/Kleinschreibung und Wortgrenzen; Vorschau mit auswählbaren Treffern, 50 pro Seite und bis zu 2.000 pro Durchlauf. Vor dem Ersetzen wird eine vollständige Projektversion gesichert.
- **Papierkorb:** In der Projektverwaltung wiederherstellen oder nach Eingabe von „LÖSCHEN“ endgültig entfernen. Dabei werden auch zugehörige Projektstände in lokalen Update-Sicherungen entfernt. Externe Dateien, Vorlagen und gemeinsame Romanwelten bleiben erhalten.
- **Projektstatus:** In den Projekteinstellungen automatisch ableiten oder manuell setzen. Die Projektfilter berücksichtigen die manuelle Angabe; Szenenstatus bleibt unabhängig.
- **Vorlagen:** Unter den Projekteinstellungen Kapitel, Szenentitel, Zusammenfassungen, Module und Ziele als Vorlage speichern und neue Projekte daraus anlegen. Manuskripttexte, Kommentare, Cover und Karten werden nicht kopiert.
- **Gemeinsame Romanwelt:** Unter Figuren & Orte eine Romanwelt anlegen oder auswählen; dieselbe Welt in weiteren Projekten wählen. Figuren und Orte zentral bearbeiten, suchen, umbenennen oder löschen. Lokale Karten können als unabhängige Kopien übernommen werden. Gemeinsame Karten werden bei der Namenserkennung berücksichtigt. Projektversionen setzen gemeinsame Romanwelten nicht zurück. Diese Funktion bleibt wie die übrigen Daten lokal auf dem Gerät und ist keine Gerätesynchronisierung.
- **Textkommentare:** Text markieren, „Kommentare“ öffnen und Notiz hinterlegen. Kommentare lassen sich bearbeiten, als erledigt markieren und über „Zur Textstelle“ wiederfinden. Bei überschriebenen Textstellen bleibt das ursprüngliche Zitat als nicht mehr zugeordneter Kommentar erhalten. Kommentare sind in JSON-Sicherungen und Versionen, nicht im Manuskriptexport enthalten.
- **Bedienung:** Einstellungen → Darstellung → Lesen & Bedienen: Textgröße, Zeilenabstand, Serifen-/Sans-Schrift, große Schaltflächen, reduzierte Animationen. Touchgeräte erhalten mindestens 44-Pixel-Schaltflächen; Suchvorschau und Dialoge passen sich schmalen Displays an. Außerhalb von Dialogen: Strg/⌘ + Umschalt + F (Suchen), M (Kommentare), S (Version).

## Neu in 0.7.0

- Fünf Farbschemata mit Hell- und Dunkelvarianten: Petrol, Sand, Wald, Lavendel und Graphit. Die Auswahl gilt auf diesem Gerät für alle Projekte und wird vor dem ersten Rendern wiederhergestellt.
- Neu gegliederte Einstellungen mit Darstellung, Autor, Projektmodulen und App & Daten. Farbvorschauen, direkt bedienbarer Dunkelmodus und responsive Auswahlfelder.

## Neu in 0.6.2

- Vier kombinierbare Statusfilter: Idee, Entwurf, Überarbeitung und Fertig. Der Projektstatus folgt dem Manuskript: alle Texte fertig → Fertig; mindestens ein Text in Überarbeitung → Überarbeitung; begonnene Texte → Entwurf; sonst Idee. Die Filterauswahl bleibt auf dem Gerät gespeichert.

- Einheitliche Projektkacheln in allen drei Covergrößen: feste Bereiche für Titel, Projektart und Reihe; Verschiebe-Buttons bündig am unteren Rand. Lange Angaben werden auf zwei Zeilen gekürzt, die vollständigen Angaben bleiben in den Projekteinstellungen und als Tooltip verfügbar.

## Neu in 0.6.1

- Alphabetische Sortierung hält Reihen unter ihrem Reihentitel zusammen und sortiert darunter natürlich nach Band (1, 2, 10). Bände ohne Angabe stehen am Ende ihrer Reihe.
- Standard-Autor in den Einstellungen: Neue und nicht individuell überschriebene Projekte übernehmen den Namen. Eine Checkbox entsperrt das Autorenfeld für abweichende Angaben. Bestehende Namen bleiben erhalten; die Vorgabe ist Teil der lokalen Bibliothek und JSON-Sicherung.

## Neu in 0.6.0

- Projektbibliothek auf Vollbild umschalten, Cover in drei Größen anzeigen.
- Nach Projektart filtern; alphabetisch, nach letzter Änderung oder frei sortieren. Ziehen am Griff funktioniert mit Maus und Touch; Pfeile ermöglichen die Bedienung ohne Ziehen. Freie Reihenfolge bleibt in der lokalen Bibliothek und JSON-Sicherung erhalten; Filter und Covergröße werden auf dem Gerät gemerkt.
- Neue Projektart **Sonstiges**: Überschrift und ein Text ohne Kapitel, Planung, Romanwelt oder Zielvorgaben. Bei Umstellung werden vorhandene Texte zusammengefügt und der vorherige Stand als Version gesichert.

## Neu in 0.5.0

- Die Projektauswahl mit dem aktuellen Titel befindet sich vollständig in der oberen Werkzeugleiste. Auf schmalen Displays bleibt eine kompakte Cover-Schaltfläche. Die Seitenleiste bietet dadurch mehr Platz für die Gliederung.
- „Projekte & Export“ zeigt Projekte als Coverkarten. Projekt auswählen → „Cover hinzufügen“; vorhandene Cover lassen sich ersetzen oder entfernen. Ohne Bild erscheint ein gestalteter Platzhalter.
- Unterstützt werden JPG, PNG und WebP bis 20 MB / 40 Megapixel. Bilder werden auf dem Gerät proportional verkleinert (maximal 768 × 1152 Pixel) und als kompakte Bilddaten gespeichert. Vorschaubilder zeigen das vollständige Cover; es werden keine Bilder zu GitHub oder einem Bilddienst übertragen.
- Cover sind optionale Projektdaten und bleiben in JSON-Sicherungen, Versionen und gelöschten/wiederhergestellten Projekten erhalten. Die Funktion dient der Darstellung in der Projektverwaltung; der EPUB-/Druckexport verwendet weiterhin die bisherigen Text-Titelseiten.

## Neu in 0.4.2

In „Projekte & Export“ das gewünschte Projekt auswählen und „Aktuelles Projekt löschen“ drücken. Nach Bestätigung wird es aus der Projektliste entfernt und vorher vollständig als Version gesichert. „Gelöschte Projekte“ stellt es samt vorhandenen Versionen wieder her. Es handelt sich um wiederherstellbares Löschen; die Daten bleiben lokal und in kompletten JSON-Sicherungen enthalten. Auch deren Import erhält gelöschte Projekte. Nach Löschen des letzten Projekts bleibt ein neues leeres Projekt, ohne Demo-Inhalte.

## Neu in 0.4.0

- Beim Anlegen: Roman (50.000 Wörter), Novelle/Erzählung (20.000) oder Kurzgeschichte (2.500) wählen. Dies sind frei änderbare Startwerte, keine literarischen Definitionen. Bestehende Projekte bleiben Romane mit Szenen; ihre Wortziele werden nicht verändert.
- Roman und Novelle können mit „Ein Text pro Kapitel“ ohne separate Szenen arbeiten. Bei bestehenden Projekten werden Texte pro Kapitel in Reihenfolge zusammengefügt; Metadaten bleiben in Notizen und der vorherigen Versionssicherung erhalten. Ideenverknüpfungen werden angepasst. Erneutes Einschalten teilt Texte nicht automatisch auf; der vorherige Aufbau kann über Versionen wiederhergestellt werden.
- Kurzgeschichten bestehen aus einem Text ohne Kapitel-/Reihen-/Bandverwaltung, auch im Export. Die Umstellung bestehender Projekte sichert zuerst den Originalstand. Ideen lassen sich zur Zusammenfassung des Gesamttexts hinzufügen.
- Unten stehen Wörter und Zeichen. Kurzgeschichten unterstützen ein abschaltbares Wortlimit und ein Zeichenlimit (0 = deaktiviert). Bei Überschreitung wird der jeweilige Zähler und Balken rot, ergänzt um den Überhang. Bei Roman/Novelle sind es Ziele, keine harten Obergrenzen.
- Gezählt wird Manuskripttext, nicht Titel, Zusammenfassungen oder Notizen. Zeichen umfassen Leerzeichen und normalisierte Absatzumbrüche; zwischen nichtleeren Textabschnitten zählen zwei Umbrüche. Unicode-Codepunkte werden gezählt (ein Emoji kann aus mehreren Codepunkten bestehen). Wettbewerbe können andere Zählregeln vorgeben.
- Projektart, Textstruktur und Ziele lassen sich in „Projekte & Export“ nachträglich ändern. Die Einstellungen sind optionale, validierte Erweiterungen der V2-Sicherung; vorhandene Daten bleiben kompatibel.

## Neu in 0.3.0

- Die Werkzeugnavigation lässt sich über „Werkzeuge / Einklappen“ reduzieren. Teile und Kapitel sind einzeln einklappbar; der Zustand bleibt auf diesem Gerät gespeichert. Die Suche findet auch Szenenzusammenfassungen und zeigt Treffer in eingeklappten Bereichen.
- Über das Kapitelmenü lassen sich Kapitelart, Nummer (z. B. 3 oder III) und ein frei benannter Teil/Akt einstellen. Gleiche Gruppennamen fassen Kapitel zusammen. Prolog und Epilog sind unnummeriert und stehen vor bzw. nach den regulären Teilen. Die Gruppierung bestimmt auch die Manuskriptreihenfolge; Nummern sind frei vergebene Beschriftungen und sortieren nicht automatisch.
- Nummern und Gruppen erscheinen auch in Markdown, EPUB und Druck/PDF. Kapitelangaben und Ideenverknüpfungen sind optionale Erweiterungen des V2-Datenschemas und bleiben in JSON-Sicherungen und Versionen enthalten. Bestehende Bücher benötigen keine Datenumstellung.
- Ideenkarte öffnen → „Ins Manuskript übernehmen“ → als neue Szene in ein bestehendes Kapitel oder als neues Kapitel übernehmen. Kurzbeschreibung und Notizen bilden die Zusammenfassung; der Manuskripttext bleibt leer und die Szene erhält den Status „Idee“. Die Zusammenfassung steht direkt am Schreibfeld zur weiteren Planung bereit.
- Die Karte wird mit der Szene verknüpft und auf „Im Manuskript“ gesetzt. Wiederholtes Übernehmen öffnet die vorhandene Szene. Der Status allein bleibt eine organisatorische Markierung; Änderungen an Karte und Szene werden nach der Übernahme nicht synchronisiert. Gelöschte Szenen können durch erneute Übernahme ersetzt werden. Vor der Übernahme entsteht eine Versionssicherung.

## Neu in 0.2.3

„Erneut erkennen“ im Bereich „Im Text entdeckt“ prüft das aktuelle Buch auch ohne neue Texteingabe. Prüfstatus und Uhrzeit machen den Abschluss sichtbar. Automatische Prüfungen laufen weiterhin nach Texteingaben; veraltete Worker-Ergebnisse werden verworfen.

Die lokalen Erkennungsregeln nutzen vollständige Wortgrenzen (kein falsches „in“ aus „kein“), schließen gewöhnliche Nomen und Artikelkonstruktionen aus und erkennen Namensangaben wie „Großmutter Anna“, „namens Élodie“ und „Stadt Nebelhain“. Explizite Namensangaben haben Vorrang vor schwachen Ortsvermutungen. Bereits angelegte Karten bleiben erhalten; verworfene Vorschläge bleiben ausgeblendet, bis sie über den separaten Knopf zurückgesetzt werden. Die Erkennung bleibt regelbasiert und kann Namen übersehen.

## Neu in 0.2.2

- Dark Mode wird auf diesem Gerät gespeichert und beim nächsten Öffnen wiederhergestellt.
- Neben Kapiteln und Szenen öffnet „…“ die Strukturverwaltung. Kapitel lassen sich anlegen, umbenennen und mit allen Szenen löschen. Szenen lassen sich in andere Kapitel verschieben, in ein eigenes Kapitel umwandeln oder löschen.
- „Kapitel in eine Szene umwandeln“ fügt die Texte in Reihenfolge zusammen und verschiebt die neue Szene in ein gewähltes anderes Kapitel. Bei mehreren Szenen werden deren Details zusätzlich in den Notizen gesammelt; die vollständigen Originaldaten bleiben in der Versionssicherung.
- Vor Strukturänderungen wird das ganze Buch als Version gesichert. Nach Löschen des letzten Inhalts bleibt eine neue leere Szene. Neue Szenen werden am Ende ihres Kapitels eingefügt; Umordnen bleibt innerhalb des Kapitels.

## Neu in 0.2

- **Buchreihe:** Projekte & Export → Neues Buch → Checkbox „Dieses Buch gehört zu einer Buchreihe“. Reihentitel und Band sind auch nachträglich änderbar.
- **Überarbeitungen:** „Version sichern“ öffnet den Versionsbereich. Ein Wechsel des Szenenstatus zu „Überarbeitung“ sichert den bisherigen Buchstand; weitere Textänderungen an überarbeiteten oder fertigen Szenen erzeugen frühestens alle zehn Minuten pro Szene einen zusätzlichen Stand. Wiederherstellen betrifft das gesamte Buch, einschließlich Karten und Reihenangaben. Vorher wird der aktuelle Stand gesichert.
- **Namen:** „Im Text entdeckt“ in der Romanwelt und in der Werkstatt zeigt lokale Vorschläge. Die regelbasierte Erkennung ist keine vollständige sprachwissenschaftliche NER: Sie kann Namen übersehen und Nomen verwechseln. Vorschläge werden erst nach Bestätigung zu Karten. Es wird kein Text übertragen.
- **Datenschema:** V1-Bibliotheken und enthaltene Versionen werden atomar auf V2 umgestellt. Die Originalbibliothek wird zuvor innerhalb derselben IndexedDB-Transaktion gesichert. Bei Fehlern wird die gesamte Umstellung abgebrochen und automatisches Speichern angehalten. Unter Projekte & Export sind Rohdaten und Update-Sicherungen als JSON herunterladbar. Ein normaler Import stellt Sicherungen als zusätzliche Bücher wieder her.

Beim erstmaligen Wechsel von 0.1 auf 0.2 gibt es in der alten Oberfläche noch keinen Update-Knopf. Nach dem Speichern Feder online öffnen, kurz auf das Laden des Updates warten, alle Feder-Fenster und die Homescreen-App schließen und erneut öffnen. Die Versionsanzeige „Feder 0.2“ bestätigt den Wechsel. Browserdaten müssen dafür nicht gelöscht werden.

## Modular erweitern

Siehe [Architektur](docs/ARCHITEKTUR.md) und [Funktionsrecherche](docs/RECHERCHE.md). Neue Werkzeuge können die Projektstruktur verwenden und eigene Ansichten registrieren. Bewusst kein Ausführen beliebiger aus dem Web heruntergeladener Plug-ins.

## Grenzen dieser ersten Version

Keine vollständige Papyrus-Funktionsparität: keine Duden-Grammatikprüfung, kein DOCX-Roundtrip, keine Änderungsverfolgung, keine freie Mindmap und kein professioneller Buchsatz. Die Schreibfläche editiert einfachen Text und Markdown; fett/kursiv wird beim EPUB-/Druckexport umgesetzt. Stilanalyse ist eine Heuristik, keine Qualitätsbewertung. OpenThesaurus bietet Synonyme, keine Grammatikprüfung. Physische iOS-/iPadOS-Geräte wurden in dieser Sitzung nicht getestet.

## Lizenz

App-Code: [MIT](LICENSE). OpenThesaurus-Daten: **LGPL 2.1 oder später**, siehe [Drittanbieterhinweise](THIRD_PARTY.md). Feder steht in keiner Verbindung zu Papyrus oder dessen Herstellern.
