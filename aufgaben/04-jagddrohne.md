# 04 – Jagddrohne (Nahkämpfer)

Status: erledigt · baut auf 01 auf

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
8. **Nur die Jagddrohne ist Teil dieser Aufgabe.** Schilddrohne und Schwerer Mech bekommen ebenfalls eine Angriffsanimation, aber in eigenen Aufgaben (vorgemerkt in `LIESMICH.md`); bis dahin verletzen sie weiter durch Berührung. Den Angriff deshalb so bauen, dass andere Nahkämpfer ihn mit eigenen Werten übernehmen können.

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
| Sind 0,35 s Ausholen genug Zeit zum Reagieren? | ja, als Startwert |

## Aufgefallen

- **Der Schlag trifft alle Höhen.** Weder Springen noch Ducken weichen ihm aus; nur Reichweite, Bogen, Dash und die Schonzeit schützen. In der Aufgabe steht nichts anderes, und es entspricht dem bisherigen Berührungsschaden. Das muss neu bedacht werden, wenn Springen und Ducken später ersetzt werden.
- **Reichweite:** Der Schlag hat „50 px ab Rand der Drohne", gerechnet wie beim Kick der Figur: Der Körper der Figur (18 px) zählt dazu, die Mitte-zu-Mitte-Reichweite ist also 14 + 50 + 18 = 82 px. Der gezeichnete Bogen hat denselben Radius. Gemessen wird die Richtung zur Mitte der Figur, nicht zu ihrem Rand.
- **Rückstoß-Schwelle:** „Treffer mit Rückstoß" ist so umgesetzt, dass ein Rückstoß-Tempo ab 60 px/s (`MELEE_INTERRUPT`) das Ausholen abbricht, egal woher er kommt (Kick, Pistole und die anderen Geschosse mit Rückstoß, Dash, Gleitschuhe, Strahl, Explosion, Aufprall). Der Flammenwerfer macht keinen Rückstoß (bereits im Bestand so) und unterbricht deshalb nicht. Während der Erholung bricht ein Rückstoß nichts ab; sie läuft zu Ende.
- Nach einem Abbruch holt sie wieder aus, sobald der Rückstoß unter die Schwelle gefallen ist und die Figur noch in Reichweite steht. Es gibt keine eigene Sperre nach einem Abbruch.
- Die Angriffsanimation (`hunter/Attack_1.png`, vier Bilder, 128 px) steht jetzt in `ENEMY_SPRITES.hunter.attack`. Fehlt die Datei, zeichnet `drawEnemy` wie bei jedem fehlenden Bild den Ersatzkreis; der Bogen am Boden erscheint in beiden Fällen.
- Die Prüfungen „Treffer setzt die Serie zurück", „Panzerung Stufe 2" und „Schildgenerator" nutzten den Berührungsschaden der Jagddrohne und laufen jetzt über den Angriff (siehe unten).
- Mutationsprobe: Ohne die Rückstoß-Schwelle, ohne den Bogen, ohne Erholzeit oder mit weiter bestehendem Berührungsschaden schlägt jeweils mindestens eine der neuen Prüfungen an.

## Übergabe an den Planer

**Umgesetzt:** Regeln 1–8 vollständig; die Vorgabe der offenen Frage (0,35 s Ausholen als Startwert) ist eingehalten.

**Neue Felder, Funktionen, Konstanten:**
- `src/sim/types.ts`: `Melee { phase: 'windup' | 'recover', t, angle }`, `Enemy.melee` (`null`, solange kein Angriff läuft).
- `src/sim/enemies.ts`: `MeleeDef` und die Tabelle `MELEE` (`windup` 0,35 s, `recover` 0,5 s, `reach` 50 px, `arc` π/3) – nur `hunter` hat einen Eintrag; wer dort einen Typ einträgt, bekommt den Angriff und verliert den Berührungsschaden. `MELEE_INTERRUPT` (60 px/s), `stepMelee` (ein Schritt des Angriffs, gibt zurück, ob die Drohne dabei steht), `strikeHits` (Reichweite und Bogen). Der Schaden des Schlags ist `e.damage`, also skaliert.
- `src/render.ts`: `drawMeleeArc` (Bogen am Boden: füllt sich beim Ausholen, blitzt beim Schlag weiß auf), aufgerufen am Anfang von `drawEnemy`.
- `src/sprites.ts`: `ENEMY_SPRITES.hunter.attack`; Bilderlauf über das Ausholen, im Moment des Schlags 0,15 s lang das letzte Bild; die Drohne schaut beim Angriff dorthin, wohin sie schlägt.

**Geänderte Prüfungen:** „Treffer setzt die Serie zurück", „Panzerung Stufe 2: 15 Schaden werden zu 11" und „Schildgenerator: fängt den ersten Treffer ab, der zweite sitzt" setzen die Jagddrohne nun 0,5 s bzw. 0,5 s + 0,9 s lang ein statt eines Schritts, weil der Schaden erst nach dem Ausholen kommt; die geprüften Regeln sind dieselben. Neu: Abschnitt „Jagddrohne: Nahkampf" in `tests/rules.ts` (kein Sofortschaden und Stillstand beim Ausholen, Weglaufen, außerhalb des Bogens, Kick, Rückstoß-Treffer, Dash, Erholzeit und Takt des zweiten Schlags, Level 6, Tempo-Grenze, der Schwere Mech verletzt weiter durch Berührung).

**Im Browser angesehen (Chromium):** Eine eigens gezeichnete Szene mit drei Jagddrohnen in verschiedenen Phasen um die Figur: Der Bogen erscheint nur beim Ausholen (und beim Schlag), zeigt zur Figur und reicht bis über sie hinaus; ohne Sprite-Bilder sieht man die Ersatzkreise. **Nicht** gesehen: die Angriffsanimation des Sprites (Bilder fehlen im Repository) und das Aufblitzen im Moment des Schlags in Bewegung.
