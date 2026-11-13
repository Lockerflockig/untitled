# 07 – Fernkämpfer mit den Waffen der Figur

Status: erledigt · baut auf 01 und auf P1 auf (beide erledigt)

> **Frei zur Umsetzung.** P1 ist erledigt. Nach dieser Aufgabe ist Schluss; die
> Reflexion am Schild (P2) bleibt beim Planer.

## Ziel

Statt einer einzigen Geschützdrohne gibt es Fernkämpfer in mehreren Klassen.
Jede Klasse führt eine der Waffen, die auch die Figur benutzen kann. Mit
steigendem Level kommen neue Klassen dazu.

## Ist-Zustand

- Typ `gunner` in `src/sim/enemies.ts`: hält 260–340 px Abstand, umkreist die Figur, zielt 0,4 s sichtbar und feuert dann ein einzelnes Geschoss auf Höhe „hoch".
- Die Waffen der Figur stehen in `WEAPONS` (`src/sim/meta.ts`); alle Projektile laufen in `src/sim/projectiles.ts`.

## Voraussetzung: P1 – erledigt

Die Projektile beider Seiten laufen in einem System, in dem jedes Projektil
weiß, wem es gehört. Ein Fernkämpfer feuert mit
`enemyFire(g, e, waffe, winkel, schaden, reichweite?)`; Tempo, Radius und Höhe
sind dort bereits für Gegner abgeschwächt (Regel 4, Zeilen „Geschosstempo" und
„Flächenschaden-Radius"). Was P1 genau bereitstellt, steht in `LIESMICH.md`
unter „Was P1 bereitstellt".

Die bisherige Geschützdrohne feuert noch über `enemyShot`. Diese Aufgabe stellt
sie auf `enemyFire` mit der Pistole um.

## Regeln

1. **Klassen nach Waffe.** Ein Fernkämpfer führt genau eine Waffe und behält sie.
2. **Reihenfolge, in der die Klassen freigeschaltet werden [fest]:**

   | Stufe | Waffe | ab Level |
   |---|---|---|
   | 1 | Pistole | 1 |
   | 2 | Schwerlaser | 5 |
   | 3 | Schrot | 10 |
   | 4 | MP | 15 |
   | 5 | Granate | 20 |
   | 6 | Flammenwerfer | 25 |
   | 7 | Präzisionsgewehr | 30 |
   | 8 | Kettenblitz | 35 |
   | 9 | Impulskanone | 40 |
   | 10 | Sägeblatt | 45 |

   Alle fünf Level kommt eine Klasse dazu. Freigeschaltete Klassen bleiben im Vorrat.
3. **Fernkämpfer weichen weiterhin vor der Figur zurück** und halten Abstand. Der Abstand richtet sich nach der Waffe: Kurzstrecken-Waffen (Schrot, Flammenwerfer) bleiben näher (Startwert 140–200 px), alle anderen wie bisher (260–340 px).
4. **Schwächer als die Version der Figur:**

   | Wert | Fernkämpfer gegenüber der Figur |
   |---|---|
   | Geschosstempo | langsamer (Startwert 45 %) |
   | Flächenschaden-Radius | −50 % |
   | Feuerrate | je Waffe eigene Abklingzeit, deutlich länger als bei der Figur |
   | Schaden | eigener Grundwert je Waffe, nicht der der Figur |

5. **Werte skalieren** wie bei allen Gegnern (Aufgabe 01): Leben, Schaden, Tempo mit Obergrenze. Geschosstempo und Radius skalieren nicht.
6. **Jeder Schuss kündigt sich an** (Zielen wie bisher, Startwert 0,4 s; beim Schwerlaser die Ladezeit des Strahls).
7. **Höhe:** Geschosse von Fernkämpfern fliegen weiter auf Höhe „hoch" und lassen sich unterducken, solange es Ducken gibt. Strahl und Explosionen treffen auf jeder Höhe.
8. Eigene Explosionen der Fernkämpfer (Granate) treffen die Figur und andere Gegner.
9. **Fernkämpfer verletzen nicht durch Berührung [fest]**, in keiner Klasse.
10. Die bisherige Geschützdrohne ist die Klasse „Pistole" und bleibt in ihren Werten, soweit diese Aufgabe nichts anderes sagt.
11. Welche Klasse erscheint, wird unter den freigeschalteten ausgewürfelt. Wie viele Fernkämpfer auf wie viele Nahkämpfer kommen, wird später eigens festgelegt; bis dahin bleibt das heutige Gewicht der Geschützdrohne im Raum.
12. **Testmodus [fest]:** Im Testmodus (`?test`, siehe `testPlan` in `src/sim/game.ts`) folgen auf die Räume mit den Gegnertypen (4–8) Räume für die Fernkämpfer: je Raum eine Waffen-Klasse mehr, in der Reihenfolge der Tabelle, die neue Klasse am häufigsten. Raum 9 hat nur Pistolen-Fernkämpfer, Raum 10 dazu Schwerlaser, und so weiter. In diesen Räumen erscheinen nur Fernkämpfer.

## Darstellung

- Fernkämpfer nutzen das Sprite der Geschützdrohne. Die Klasse erkennt man an der Farbe des Zielrings und an der Waffe (Waffenbild aus `assets/guns/`, falls vorhanden).
- Geschosse sehen aus wie die der Figur, aber in einer Feindfarbe.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- In Level 1 erscheinen nur Pistolen-Fernkämpfer; in Level 5 auch Schwerlaser; in Level 10 auch Schrot.
- Ein Geschoss eines Fernkämpfers ist langsamer als das der Figur mit derselben Waffe.
- Die Explosion einer gegnerischen Granate hat den halben Radius der Granate der Figur und trifft die Figur darin, außerhalb nicht.
- Ein Schrot-Fernkämpfer hält einen geringeren Abstand als ein Pistolen-Fernkämpfer.
- Vor jedem Schuss vergeht die Ankündigung.
- Der Schaden in Level 6 ist höher als in Level 1.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Reihenfolge ab Stufe 7 | wie in der Tabelle |
| Sollen Fernkämpfer auch Kettenblitz, Impulskanone und Sägeblatt bekommen, oder sind die zu unfair? | ja, alle |

## Aufgefallen

- **Alle Zahlen sind Startwerte.** Schaden (Pistole 12, Schwerlaser 25, Schrot 7 je Pellet, MP 5, Granate 22, Flammenwerfer 4, Präzisionsgewehr 28, Kettenblitz 14, Impulskanone 8, Sägeblatt 12), Abklingzeit und Salven stehen in `RANGED`; die Aufgabe gab nur die Pistole vor (12, 1,1 s, 0,4 s). Die übrigen sind geschätzt und ungetestet im Spielgefühl.
- **MP und Flammenwerfer feuern Salven** (4 Schüsse im Abstand 0,12 s bzw. 6 im Abstand 0,09 s, die Drohne steht dabei still), weil ein Einzelschuss bei diesen Waffen sinnlos wäre. Die Aufgabe nennt das nicht ausdrücklich; es folgt aus „je Waffe eigene Abklingzeit" und kann über `burst` je Klasse abgeschaltet werden.
- **Kettenblitz, Impulskanone und Sägeblatt gegen die Figur:** Das Springen des Blitzes (`chain`) und der Rückstoß des Impulses (`push`) wirken nur gegen Gegner; auf die Figur macht der Fernkämpfer-Schuss damit einfach seinen Schaden. Das Sägeblatt prallt dreimal von den Wänden ab. Die Vorgabe der offenen Frage („ja, alle") ist so umgesetzt; ob sie fair sind, zeigt das Spielen.
- **Schwerlaser:** Die Drohne zielt nur 0,2 s, danach kündigt sich der Strahl 0,8 s lang an (Dauer aus `ENEMY_BEAM_CHARGE`), dann brennt er 0,25 s. Sie steht still, bis er durch ist (`hold` 1,1 s). Der Strahl ist „voll" (magenta) und trifft den Geduckten; nur Dash schützt. Vorher zeichnete der Renderer jeden Strahl blau; er nimmt jetzt die Höhe des Strahls.
- **Zielring und Waffenbild:** Die Klasse erkennt man am Ring (`RANGED_COLOR` in `src/sprites.ts`) und am Waffenbild (`drawGunIcon` in `src/playerSprite.ts`). Die Bilder fehlen im Repository; ohne sie bleibt nur der Ring, und das Ersatz-Bild der Drohne (Kreis) ist für alle Klassen gleich orange. Die Geschosse haben weiter die Form der Waffe der Figur mit dem blauen Ring der Feindmarkierung aus P1; eine eigene „Feindfarbe" je Geschossform habe ich nicht dazugebaut.
- Die Ankündigung des Erscheinens (gestrichelter Ring am Boden) zeigt die Klasse noch nicht; die Klasse wird erst beim Erscheinen gewürfelt.
- Der Schaden an der Figur durch den Schrot-Fächer ist praktisch der eines Pellets, weil die Schonzeit (0,6 s) nach dem ersten Treffer die übrigen schluckt (Bestand).
- Rennen die Räume des Testmodus durch, folgt ab Raum 19 die normale Raumfolge; die bisherige Prüfung „nach Raum 8" prüft deshalb jetzt Raum 19 (Regel 12 ändert genau das).

## Übergabe an den Planer

**Umgesetzt:** Regeln 1–12 vollständig. Vorgaben der offenen Fragen eingehalten (Reihenfolge wie in der Tabelle; alle zehn Klassen).

**Neue Felder, Funktionen, Konstanten:**
- `src/sim/enemies.ts`: `RangedDef` und die Tabelle `RANGED` (Waffe → `windup`, `cooldown`, `damage`, `range`, optional `burst`, `hold`), `RANGED_ORDER`, `rangedUnlockLevel(waffe)`, `unlockedRanged(level)`, `rangedOf(e)`; Die Geschützdrohne feuert jetzt über `enemyFire` (Pistole = die alte Klasse). Konstanten der alten Geschützdrohne (`GUNNER_RANGE`, `GUNNER_SHOT_SPEED`, `GUNNER_SHOT_DAMAGE`, `GUNNER_WINDUP`) entfallen. `makeEnemy(kind, x, y, level, weapon)`.
- `src/sim/types.ts`: `Enemy.weapon`, `Enemy.volley`, `Enemy.hold`; `RoomPlan.gunners` (Klassen mit Gewicht).
- `src/sim/game.ts`: `roomPlan` setzt `gunners: unlockedRanged(n)`; `testPlan` kennt die Räume 9–18.
- `src/sprites.ts`: `RANGED_COLOR`; `src/playerSprite.ts`: `drawGunIcon`; `src/render.ts`: `drawRangedWeapon`, Strahlfarbe nach Höhe.

**Geänderte Prüfungen:** „Testmodus: nach Raum 8 … gilt die normale Raumfolge" prüft jetzt Raum 19 (Regel 12 verlängert den Testmodus). Neu: Abschnitte „Fernkämpfer-Klassen" und „Testmodus: Fernkämpfer-Räume" in `tests/rules.ts` (Freischaltung, Spawn je Level, Waffe bleibt und kein Berührungsschaden, Tempo 45 %, Ankündigung, Schaden Level 6, Strahl-Ankündigung und -Schaden, Schrot-Fächer, Abstände, Granate: Radius 45, trifft Figur innen und nicht außen, trifft Gegner, Testmodus-Räume).

**Im Browser angesehen (Chromium):** Eine eigens gezeichnete Szene mit sieben Fernkämpfern (Pistole, Schrot, Granate, Schwerlaser, Flammenwerfer, MP, Präzisionsgewehr) mitten im Feuern: Schwerlaser-Strahl in Magenta, Schrot-Fächer, Flammen, Granate, die Geschosse mit blauem Feind-Ring. Außerdem Rauchtests im Testmodus (`?test&raum=12` und `raum=18`, „Test · Raum 18" in der Leiste) ohne Konsolenfehler. **Nicht** gesehen: Sprite, Waffenbilder und Klassen-Ringe im Spielbild (Bilder fehlen im Repository).
