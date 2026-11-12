# 01 – Gegner skalieren mit dem Level

Status: erledigt (ohne Boss-Anteile, siehe „Aufgefallen")

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
3. **Formeln – exponentielles Wachstum [fest]** (n = Level, beginnend bei 1):

   | Wert | Formel | Obergrenze |
   |---|---|---|
   | Leben | Grundwert × 1,10^(n − 1) | keine |
   | Schaden | Grundwert × 1,06^(n − 1) | keine |
   | Tempo | Grundwert × 1,03^(n − 1) | je Typ, siehe unten (harte Grenze) |

   Ergebnisse auf ganze Zahlen runden. Die drei Wachstumsfaktoren sind
   benannte Konstanten an einer Stelle; an ihnen wird im Balancing gedreht,
   sobald getestet ist. Zur Einordnung: Leben ist in Level 10 das 2,4-fache,
   in Level 20 das 6,1-fache; Schaden in Level 10 das 1,7-fache, in Level 20
   das 3,0-fache.
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
8. **Boss:** `BOSS_HP_GROWTH` entfällt. Der Boss skaliert wie alle über sein Level. Sein Grundwert für Leben wird so gesetzt, dass er in Level 5 wieder 900 Trefferpunkte hat (Grundwert 615).
9. **Mehr Gegner mit höherem Level [fest]:** `maxEnemies` und die Erscheinungsrate steigen weiter mit dem Level. Die genauen Mengen und das Verhältnis von Nah- zu Fernkämpfern werden später eigens überarbeitet (siehe `LIESMICH.md`, „Vorgemerkt"); bis dahin bleiben die heutigen Werte.
10. **Punkte** ändern sich nicht; der Raum-Multiplikator belohnt höhere Level bereits.

## Darstellung

- Die Lebensleiste rechnet mit `maxHp` des Gegners (tut sie schon).
- Keine neue Anzeige für das Level der Gegner.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- `enemyStats('hunter', 1)` liefert die Grundwerte; in Level 6 ist das Leben 64 (40 × 1,10⁵), der Schaden 20 (15 × 1,06⁵), das Tempo 191 (165 × 1,03⁵).
- Das Tempo der Jagddrohne erreicht seine Obergrenze 250 und bleibt dort (Level 40 prüfen).
- Ein in Level 6 erschienener Gegner zieht der Figur bei Berührung den skalierten Schaden ab.
- Ein Geschoss einer Geschützdrohne aus Level 6 macht mehr Schaden als eines aus Level 1.
- Der Boss in Level 5 hat 900 Trefferpunkte, der in Level 10 entsprechend der Formel mehr.
- Radius, Masse und Punkte sind in Level 1 und Level 20 gleich.
- Bestehende Prüfungen mit festen Schadens- oder Lebenswerten laufen in Level 1 weiter unverändert durch.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Gilt die Tempo-Obergrenze je Typ oder ein einziger Wert für alle? | je Typ |
| Sollen Angriffsfrequenz und Geschosstempo ebenfalls skalieren? | nein, erst bei der Überarbeitung der jeweiligen Klasse |
| Skaliert auch der Schaden der Gefahren im Raum (Laser, Minen …)? | nein, eigene Aufgabe |

## Aufgefallen

- **Boss ausgenommen (auf Anweisung des Auftraggebers).** Alles, was den Boss betrifft, ist liegen geblieben: Regel 8 (`BOSS_HP_GROWTH` entfällt, Grundwert 615), der Boss-Anteil von Regel 5 (Boss-Geschosse und Boss-Bodenfelder skalieren nicht) und die Prüfung „Boss in Level 5/10". `enterRoom` (`src/sim/game.ts`) erzeugt den Boss ausdrücklich mit `makeEnemy('boss', …, 1)`; `ENEMIES.boss.hp` bleibt 900, `BOSS_HP_GROWTH` bleibt. Für Aufgabe 06 ist das eine kleine Umstellung: Level `g.room` übergeben, `hp: 615` setzen, `BOSS_HP_GROWTH` löschen, `BOSS_SHOT_DAMAGE` mit `scaledDamage` skalieren und den Bodenfeldern (`Field`, `src/sim/types.ts`) ein eigenes `damage`-Feld geben – heute lesen sie die Konstante `FIELD_DAMAGE`.
- Die Sprengdrohne steht mit 225 → 290 px/s in der Tempo-Tabelle, wie hier vorgegeben. Aufgabe 03 ersetzt das durch „1,5 × Tempo der Figur".
- Die Ersatz-Lebensleiste in `src/render.ts` (ohne Sprite-Bilder) rechnete noch mit dem Grundwert des Typs statt mit `maxHp`; das war nötig, damit sie bei skalierten Gegnern stimmt, und ist geändert.
- Nebenwirkung von `npm install`: Es entsteht eine `package-lock.json`. Sie ist nicht im Repository und wurde nicht eingecheckt.

## Übergabe an den Planer

**Umgesetzt:** Regeln 1–7, 9 und 10. Regel 8 und der Boss-Anteil von Regel 5 bewusst nicht (siehe „Aufgefallen"). Die Vorgaben der offenen Fragen sind eingehalten (Tempo-Grenze je Typ; Angriffsfrequenz und Geschosstempo skalieren nicht; Gefahren im Raum skalieren nicht).

**Neue Felder, Funktionen, Konstanten:**
- `src/sim/core.ts`: `enemyStats(kind, level)` liefert `{ hp, speed, damage }`; `scaledDamage(base, level)` skaliert jeden Schaden, den ein Gegner verursacht; `HP_GROWTH` (1,10), `DAMAGE_GROWTH` (1,06), `SPEED_GROWTH` (1,03); `EnemyDef.speedMax` je Typ.
- `src/sim/types.ts`: `Enemy.level`, `Enemy.speed`, `Enemy.damage`.
- `src/sim/enemies.ts`: `makeEnemy(kind, x, y, level = 1)`; erscheinende Gegner bekommen `g.room` als Level. Geschütz-Schuss und Explosion der Sprengdrohne laufen über `scaledDamage(…, e.level)`.
- `src/sim/game.ts`: `SPAWN_MIX` (ab welchem Level welcher Typ mit welchem Gewicht), `MAX_ENEMIES`, `SPAWN_EVERY`, `BOSS_ROOM`; `roomPlan` liest sie. Die Werte sind die heutigen.

**Geänderte Prüfungen:** keine. Neu ist der Abschnitt „Skalierung mit dem Level" in `tests/rules.ts` (Grundwerte und Level 6, Tempo-Grenze, skalierte Berührung mit dem Schweren Mech, Geschützschuss Level 1 gegen 6, Level beim Erscheinen, Punkte/Radius/Masse, Typen ab Level, Mengen). Die Berührungsprüfung nutzt bewusst den Schweren Mech, weil die Jagddrohne in Aufgabe 04 keinen Berührungsschaden mehr hat.

**Im Browser angesehen:** Rauchtest mit Chromium (Raum 6, Cyborg, vier Sekunden gespielt): startet, läuft, keine Konsolenfehler. Die Sprite-Bilder fehlen im Repository; gesehen wurden die Ersatzformen. Es gibt keine neue Anzeige, also nichts weiter zu prüfen.
