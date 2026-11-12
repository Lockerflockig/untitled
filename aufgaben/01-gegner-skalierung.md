# 01 – Gegner skalieren mit dem Level

Status: offen

## Ziel

Gegner werden mit jedem Level stärker: welche Typen auftauchen, wie schnell
sie sind, wie viel sie aushalten, wie viele es sind und wie viel Schaden sie
machen. Die Geschwindigkeit hat eine Obergrenze. „Level" ist die Raumnummer
(`g.room`).

Das ist die Grundlage dafür, jede Gegnerklasse danach einzeln zu überarbeiten
(Aufgabe 02 und folgende).

## Ist-Zustand

- Feste Werte je Typ in `ENEMIES` (`src/sim/core.ts`): Radius, Leben, Tempo, Berührungsschaden, Masse, Punkte.
- Vom Level hängen nur ab: welche Typen erscheinen, `maxEnemies` und `spawnEvery` (alles in `roomPlan`, `src/sim/game.ts`) sowie die Trefferpunkte des Bosses (`BOSS_HP_GROWTH`).
- Schaden von Geschossen und Explosionen steht als Konstante in `src/sim/enemies.ts` und `src/sim/hazards.ts`.

## Regeln

1. **Eine Stelle für die Skalierung.** Eine Funktion `enemyStats(kind, level)` liefert die Werte eines Typs für ein Level. Alles, was heute `ENEMIES[kind].hp`, `.speed` oder `.damage` liest, nutzt stattdessen die Werte, die der Gegner beim Erscheinen bekommen hat. Radius, Masse und Punkte skalieren nicht.
2. **Werte hängen am Gegner.** Jeder Gegner trägt sein eigenes `speed`, `damage`, `maxHp` und sein `level`. Sie werden beim Erscheinen festgelegt und ändern sich danach nicht.
3. **Formeln** (n = Level, beginnend bei 1):

   | Wert | Formel | Obergrenze |
   |---|---|---|
   | Leben | Grundwert × (1 + 0,12 × (n − 1)) | keine |
   | Schaden | Grundwert × (1 + 0,08 × (n − 1)) | keine |
   | Tempo | Grundwert × (1 + 0,04 × (n − 1)) | je Typ, siehe unten |

   Ergebnisse auf ganze Zahlen runden.
4. **Tempo-Obergrenze je Typ** (px/s). Kein Verfolger darf dauerhaft schneller sein als die Figur ohne Upgrades (300):

   | Typ | Grundwert | Obergrenze |
   |---|---|---|
   | Jagddrohne | 165 | 250 |
   | Geschützdrohne | 115 | 170 |
   | Schilddrohne | 125 | 190 |
   | Sprengdrohne | 225 | 290 |
   | Schwerer Mech | 88 | 130 |
   | Boss | 52 | 80 |

5. **Schaden skaliert überall, wo ein Gegner ihn verursacht:** Berührung, Geschosse von Geschützdrohne und Boss, Explosion der Sprengdrohne, Bodenfelder des Bosses. Maßgeblich ist das Level des Gegners, von dem der Schaden ausgeht. Geschosse und Felder merken sich ihren Schaden beim Entstehen.
6. **Nicht von Gegnern stammende Gefahren** (Laser, Zielstrahl, Minen, Fässer, Geschütze, Bodenfelder aus dem Raum) bleiben in dieser Aufgabe unverändert.
7. **Anzahl und Typen** bleiben in `roomPlan`, werden dort aber als Teil derselben Skalierung lesbar gemacht: `maxEnemies`, `spawnEvery` und die Typ-Gewichte je Level an einer Stelle, mit Kommentar, ab welchem Level welcher Typ dazukommt. Die heutigen Werte bleiben.
8. **Boss:** `BOSS_HP_GROWTH` entfällt. Der Boss skaliert wie alle über sein Level. Sein Grundwert für Leben wird so gesetzt, dass er in Level 5 wieder 900 Trefferpunkte hat.
9. **Punkte** ändern sich nicht; der Raum-Multiplikator belohnt höhere Level bereits.

## Darstellung

- Die Lebensleiste rechnet mit `maxHp` des Gegners (tut sie schon).
- Keine neue Anzeige für das Level der Gegner.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- `enemyStats('hunter', 1)` liefert die Grundwerte; in Level 6 ist das Leben 64, der Schaden 21, das Tempo 198.
- Das Tempo der Jagddrohne erreicht seine Obergrenze 250 und bleibt dort (Level 40 prüfen).
- Ein in Level 6 erschienener Gegner zieht der Figur bei Berührung den skalierten Schaden ab.
- Ein Geschoss einer Geschützdrohne aus Level 6 macht mehr Schaden als eines aus Level 1.
- Der Boss in Level 5 hat 900 Trefferpunkte, der in Level 10 entsprechend der Formel mehr.
- Radius, Masse und Punkte sind in Level 1 und Level 20 gleich.
- Bestehende Prüfungen mit festen Schadens- oder Lebenswerten laufen in Level 1 weiter unverändert durch.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Wachsen die Werte linear oder in Stufen (z. B. alle fünf Level ein Sprung nach dem Boss)? | linear, wie oben |
| Gilt die Tempo-Obergrenze je Typ oder ein einziger Wert für alle? | je Typ |
| Sollen Angriffsfrequenz und Geschosstempo ebenfalls skalieren? | nein, erst bei der Überarbeitung der jeweiligen Klasse |
| Skaliert auch der Schaden der Gefahren im Raum (Laser, Minen …)? | nein, eigene Aufgabe |

## Aufgefallen

(vom umsetzenden Agenten auszufüllen)
