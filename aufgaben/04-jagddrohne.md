# 04 – Jagddrohne (Nahkämpfer)

Status: offen · baut auf 01 auf

## Ziel

Der Nahkämpfer verletzt nicht mehr durch bloße Berührung, sondern greift mit
einer sichtbaren Angriffsanimation an. Das macht den Schaden lesbar und
bereitet eine spätere Parry-Mechanik vor.

## Ist-Zustand

- Typ `hunter`. Läuft auf die Figur zu; bei Berührung gibt es sofort Schaden, danach schützt die Schonzeit der Figur.
- Im Sprite-Paket liegt eine Angriffsanimation bereit (`public/assets/enemies/hunter/Attack_1.png`, vier Bilder), sie wird noch nicht verwendet.

## Regeln

1. **Kein Berührungsschaden mehr.** Die Jagddrohne verletzt nur durch ihren Angriff.
2. **Angriff in drei Phasen:**

   | Phase | Dauer | Was passiert |
   |---|---|---|
   | Ausholen | 0,35 s | Die Drohne bleibt stehen und zeigt die Angriffsanimation. Die Richtung wird zu Beginn festgelegt. |
   | Schlag | ein Moment | Trifft die Figur, wenn sie im Bogen vor der Drohne steht: Reichweite 50 px ab Rand der Drohne, halber Öffnungswinkel 60°. |
   | Erholen | 0,5 s | Die Drohne steht und kann nicht angreifen. |

3. **Auslöser:** Sie holt aus, sobald die Figur in Reichweite des Schlags ist.
4. **Ausweichen:** Wer während des Ausholens aus dem Bogen läuft, dasht oder die Drohne wegkickt, wird nicht getroffen. Ein Kick oder Treffer mit Rückstoß bricht das Ausholen ab.
5. **Alle Werte skalieren** mit dem Level (Aufgabe 01): Leben, Schaden, Tempo. **Das Tempo hat eine harte Obergrenze** (Aufgabe 01, 250 px/s).
6. Die Dauer der Phasen und die Reichweite skalieren nicht.
7. Gekickte und fliegende Drohnen greifen nicht an (wie bisher).

## Darstellung

- Ausholen: Angriffsanimation des Sprites über die Dauer der Phase; zusätzlich wird der Bogen, den der Schlag trifft, am Boden angedeutet (wie beim Kick der Figur).
- Ohne Sprite-Bilder: der angedeutete Bogen reicht als Anzeige.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- Eine Jagddrohne, die die Figur berührt, verletzt sie nicht sofort, sondern erst nach dem Ausholen.
- Läuft die Figur während des Ausholens aus dem Bogen, bleibt sie unverletzt.
- Ein Kick während des Ausholens bricht den Angriff ab.
- Nach einem Schlag vergeht die Erholzeit, bevor der nächste Angriff beginnt.
- Schaden und Leben in Level 6 entsprechen der Formel aus Aufgabe 01; das Tempo überschreitet 250 nie.

Bestehende Prüfungen, die den Berührungsschaden der Jagddrohne als Mittel nutzen (z. B. „Treffer setzt die Serie zurück"), werden auf den Angriff umgestellt.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Gilt die Angriffsanimation nur für die Jagddrohne oder auch für Schilddrohne und Schweren Mech, die heute ebenfalls durch Berührung verletzen? | nur Jagddrohne; die anderen folgen bei ihrer eigenen Überarbeitung |
| Sind 0,35 s Ausholen genug Zeit zum Reagieren? | ja, als Startwert |

## Aufgefallen

(vom umsetzenden Agenten auszufüllen)
