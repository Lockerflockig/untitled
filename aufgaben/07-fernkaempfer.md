# 07 – Fernkämpfer mit den Waffen der Figur

Status: offen · baut auf 01 und auf P1 (Planer) auf

## Ziel

Statt einer einzigen Geschützdrohne gibt es Fernkämpfer in mehreren Klassen.
Jede Klasse führt eine der Waffen, die auch die Figur benutzen kann. Mit
steigendem Level kommen neue Klassen dazu.

## Ist-Zustand

- Typ `gunner` in `src/sim/enemies.ts`: hält 260–340 px Abstand, umkreist die Figur, zielt 0,4 s sichtbar und feuert dann ein einzelnes Geschoss auf Höhe „hoch".
- Die Waffen der Figur stehen in `WEAPONS` (`src/sim/meta.ts`); ihre Geschosse laufen in `src/sim/player.ts`.

## Voraussetzung: P1 [Planer]

Die Geschosse der Figur und der Gegner laufen heute getrennt. Damit ein Gegner
„dieselbe Waffe" abfeuern kann, braucht es ein gemeinsames Projektil-System,
in dem jedes Projektil weiß, wem es gehört. Das setzt der Planer um (siehe
`LIESMICH.md`, „Dem Planer vorbehalten"). **Diese Aufgabe beginnt erst, wenn
P1 erledigt ist.** P1 stellt bereit: eine Funktion, mit der ein Gegner eine
Waffe aus `WEAPONS` in eine Richtung abfeuert.

## Regeln

1. **Klassen nach Waffe.** Ein Fernkämpfer führt genau eine Waffe und behält sie.
2. **Reihenfolge, in der die Klassen freigeschaltet werden:**

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
9. Die bisherige Geschützdrohne ist die Klasse „Pistole" und bleibt in ihren Werten, soweit diese Aufgabe nichts anderes sagt.
10. Welche Klasse erscheint, wird unter den freigeschalteten ausgewürfelt. Wie viele Fernkämpfer auf wie viele Nahkämpfer kommen, wird später eigens festgelegt; bis dahin bleibt das heutige Gewicht der Geschützdrohne im Raum.

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
| Deine Liste nennt „Lvl 1 bis 7" für die Waffen, davor steht „alle 5 Lvl". Ich lese die Liste als Stufen, die alle fünf Level freigeschaltet werden. | so wie in der Tabelle oben |
| Beginnt Stufe 2 bei Level 5 oder bei Level 6 (also nach dem ersten Boss)? | Level 5 |
| Reihenfolge ab Stufe 7 | wie in der Tabelle |
| Sollen Fernkämpfer auch Kettenblitz, Impulskanone und Sägeblatt bekommen, oder sind die zu unfair? | ja, alle |

## Aufgefallen

(vom umsetzenden Agenten auszufüllen)
