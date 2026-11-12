# Aufgaben für die Umsetzung

In diesem Ordner liegen Anweisungen für den Agenten, der umsetzt. Jede Datei
ist eine abgeschlossene Aufgabe. Die Planung (was und warum) passiert vorher;
hier steht das Ergebnis.

## Reihenfolge

Die Dateien sind nummeriert und bauen aufeinander auf. Eine Aufgabe ist
erledigt, wenn ihre Abnahme-Prüfungen bestehen; dann den Kopf der Datei auf
`Status: erledigt` setzen.

| Nr. | Aufgabe | Status |
|---|---|---|
| 01 | [Gegner skalieren mit dem Level](01-gegner-skalierung.md) | offen |
| 02 | [Schilddrohne](02-schilddrohne.md) | offen, baut auf 01 auf; Reflexion macht der Planer |

## Dem Planer vorbehalten

Teile, deren Umsetzung schwierig ist, setzt der Planer später selbst um. Sie
sind in der jeweiligen Aufgabe mit **[Planer]** markiert und stehen hier
gesammelt. Der umsetzende Agent baut sie nicht, sondern lässt die Stelle so
vorbereitet, wie die Aufgabe es beschreibt.

| Aufgabe | Teil | Warum schwierig |
|---|---|---|
| 02 | Reflexion von Projektilen am Schild (Regeln 4–9) | Geschosse der Figur und der Gegner laufen heute in zwei getrennten Listen mit getrennter Trefferlogik; für die Reflexion müssen beide gegen beide Seiten treffen können, ohne die bestehenden Regeln zu brechen |

## Was für jede Aufgabe gilt

- **Erst lesen:** `KONZEPT.md` (Regeln des Spiels) und die Aufgabe selbst ganz.
- **Wo die Logik liegt:** `src/sim/` – fester Zeitschritt (`STEP`), kein Canvas, kein DOM. Darstellung in `src/render.ts`, `src/sprites.ts`, `src/playerSprite.ts`; Menüs und Eingabe in `src/main.ts`.
- **Prüfungen:** Jede neue Regel bekommt eine Prüfung in `tests/rules.ts`. `npm test` muss am Ende ohne Fehlschlag durchlaufen (Node ab 22.6). Bestehende Prüfungen dürfen nur angepasst werden, wenn die Aufgabe die geprüfte Regel ausdrücklich ändert.
- **Build:** `docker compose up -d --build` muss durchlaufen (enthält die Typprüfung).
- **Zahlen als benannte Konstanten** oben in der jeweiligen Datei, mit Einheit im Kommentar. Sie sind Startwerte fürs Balancing.
- **Sprache:** Kommentare, Bezeichnungen im Spiel und Commit-Texte auf Deutsch, wie im Bestand.
- **Bilder:** Die Sprite-Dateien unter `public/assets/` sind nicht im Repository (siehe `public/assets/LIESMICH.txt`). Alles muss auch ohne sie laufen; neue Darstellungen deshalb per Code zeichnen oder einen gezeichneten Ersatz vorsehen.
- **Nicht anfassen**, was die Aufgabe nicht nennt. Fällt unterwegs etwas auf, das geändert werden sollte, am Ende unter „Aufgefallen" in die Aufgaben-Datei schreiben statt es mitzuändern.
- **Offene Fragen** in der Aufgabe sind mit einer Vorgabe versehen. Nach der Vorgabe bauen; die Frage bleibt stehen, bis sie entschieden ist.
- **Am Ende:** `KONZEPT.md` an den Stellen nachziehen, die die Aufgabe ändert.
