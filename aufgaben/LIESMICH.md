# Aufgaben für die Umsetzung

In diesem Ordner liegen Anweisungen für den Agenten, der umsetzt. Jede Datei
ist eine abgeschlossene Aufgabe. Die Planung (was und warum) passiert vorher;
hier steht das Ergebnis.

## Leitlinie

Das Spiel soll schwer sein. Zugleich soll der Spieler Kombinationen aus
Passiven (Modulen) und Waffen finden können, deren Zusammenspiel viel bewirkt.
Im Zweifel also: Gegner gefährlich lassen und dem Spieler starke Werkzeuge
geben, statt beides abzuschwächen.

## Reihenfolge

Die Dateien sind nummeriert. Eine Aufgabe ist erledigt, wenn ihre
Abnahme-Prüfungen bestehen; dann den Kopf der Datei und diese Tabelle auf
„erledigt" setzen.

| Nr. | Aufgabe | Voraussetzung | Status |
|---|---|---|---|
| 01 | [Gegner skalieren mit dem Level](01-gegner-skalierung.md) | – | offen |
| 02 | [Schilddrohne](02-schilddrohne.md) | 01 | offen; Reflexion macht der Planer |
| 03 | [Sprengdrohne](03-sprengdrohne.md) | 01 | offen |
| 04 | [Jagddrohne](04-jagddrohne.md) | 01 | offen |
| 05 | [Laser vereinfachen](05-laser-vereinfachen.md) | – | offen |
| 06 | [Boss: Panzer](06-boss-panzer.md) | 01, 03 | offen |
| 07 | [Fernkämpfer mit Waffen](07-fernkaempfer.md) | 01, P1 | wartet auf P1 |

01 und 05 können sofort beginnen. 02, 03 und 04 fassen alle
`src/sim/enemies.ts` an und sollten nacheinander laufen, nicht gleichzeitig.

## Dem Planer vorbehalten

Teile, deren Umsetzung schwierig ist, setzt der Planer später selbst um. Sie
sind in der jeweiligen Aufgabe mit **[Planer]** markiert und stehen hier
gesammelt. Der umsetzende Agent baut sie nicht, sondern lässt die Stelle so
vorbereitet, wie die Aufgabe es beschreibt.

| Kürzel | Teil | Gebraucht für | Warum schwierig |
|---|---|---|---|
| P1 | Gemeinsames Projektil-System: Jedes Projektil kennt seinen Besitzer; Gegner können Waffen aus `WEAPONS` abfeuern; Projektile können die Seite wechseln | 02 (Reflexion), 07 | Geschosse der Figur und der Gegner laufen heute in zwei getrennten Listen mit getrennter Trefferlogik; das Zusammenführen berührt Treffer, Höhen, Punkte und die Darstellung |
| P2 | Reflexion von Projektilen am Schild der Schilddrohne (Aufgabe 02, Regeln 4–9) | 02 | baut auf P1 auf |

## Vorgemerkt – noch keine Aufgabe

Das ist entschieden oder angedacht, aber noch nicht ausgearbeitet. Nicht
umsetzen, bis es eine eigene Aufgaben-Datei gibt.

- **Spawn-Vorräte:** wie viele Fernkämpfer auf wie viele Nahkämpfer kommen, welche Mischung in welchem Level.
- **Mehr Gegner mit höherem Level:** Mengen und Erscheinungsrate neu festlegen.
- **Übrige Gegnerklassen** einzeln überarbeiten: Schwerer Mech.
- **Geschütze, Minen, Fässer, Bodenfelder, Zielstrahl:** Skalierung und Überarbeitung.
- **Loot-System** weiter ausarbeiten.
- **Eigene Explosionen** können auch der Figur schaden.
- **Minen** eventuell als passive Fähigkeit der Figur.
- **Aufgaben der Räume** überarbeiten: Räume ohne Kill-Aufgabe oder Zeitlimit lassen sich ausnutzen, indem man die Aufgabe nicht abschließt.
- **Preise und Fortschritt:** Derzeit reicht ein Run, um alles gekauft zu haben.
- **Ducken/Slide und Springen ersetzen**, zum Beispiel durch Parry und eine Fähigkeit. Aufgabe 04 (Angriffsanimation) und 05 (Laser) bereiten das vor.
- Grundsätzlich soll alles noch einmal überarbeitet und ausgearbeitet werden.

## Was für jede Aufgabe gilt

- **Erst lesen:** `KONZEPT.md` (Regeln des Spiels) und die Aufgabe selbst ganz.
- **Wo die Logik liegt:** `src/sim/` – fester Zeitschritt (`STEP`), kein Canvas, kein DOM. Darstellung in `src/render.ts`, `src/sprites.ts`, `src/playerSprite.ts`; Menüs und Eingabe in `src/main.ts`; Ton in `src/audio.ts`.
- **Prüfungen:** Jede neue Regel bekommt eine Prüfung in `tests/rules.ts`. `npm test` muss am Ende ohne Fehlschlag durchlaufen (Node ab 22.6). Bestehende Prüfungen dürfen nur angepasst werden, wenn die Aufgabe die geprüfte Regel ausdrücklich ändert.
- **Build:** `docker compose up -d --build` muss durchlaufen (enthält die Typprüfung).
- **Zahlen als benannte Konstanten** oben in der jeweiligen Datei, mit Einheit im Kommentar. Sie sind Startwerte fürs Balancing.
- **Sprache:** Kommentare, Bezeichnungen im Spiel und Commit-Texte auf Deutsch, wie im Bestand.
- **Bilder und Töne:** Die Sprite-Dateien unter `public/assets/` sind nicht im Repository (siehe `public/assets/LIESMICH.txt`). Alles muss auch ohne sie laufen; neue Darstellungen deshalb per Code zeichnen oder einen gezeichneten Ersatz vorsehen. Neue Töne bekommen einen per Code erzeugten Platzhalter und einen Namen für `public/sounds/sounds.json`.
- **Zum Testen im Browser:** `?raum=6`, `?charakter=cyborg` und `?punkte=20000` an die Adresse hängen.
- **Nicht anfassen**, was die Aufgabe nicht nennt. Fällt unterwegs etwas auf, das geändert werden sollte, am Ende unter „Aufgefallen" in die Aufgaben-Datei schreiben statt es mitzuändern.
- **Offene Fragen** in der Aufgabe sind mit einer Vorgabe versehen. Nach der Vorgabe bauen; die Frage bleibt stehen, bis sie entschieden ist.
- **Am Ende:** `KONZEPT.md` an den Stellen nachziehen, die die Aufgabe ändert.
