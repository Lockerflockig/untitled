# 02 – Schilddrohne

Status: offen · baut auf 01 auf

## Ziel

Die erste einzeln überarbeitete Gegnerklasse. Aus dem bisherigen „Schild-Mech"
wird die **Schilddrohne**: Ihr Schild wirft Geschosse zurück, statt sie nur zu
schlucken, und sie hinterlässt beim Zerstören eine Explosion und Spuren am
Boden.

## Ist-Zustand

- Typ `shield` in `src/sim/core.ts` und `src/sim/enemies.ts`. Der Schild dreht sich mit `SHIELD_TURN` (2,2 rad/s) zur Figur.
- Geschosse der Figur, die im Bogen von ±70° (`SHIELD_BLOCK` in `src/sim/player.ts`) von vorn kommen, verschwinden. Der Schwerlaser endet am Schild.
- Beim Tod passiert nichts Besonderes.

## Regeln

### Name
1. Der Typ heißt im Spiel „Schilddrohne". Die Kennung `shield` im Code bleibt.

### Ausrichtung des Schilds
2. Der Schild richtet sich langsam immer zur Figur aus, mit fester Drehrate. **Diese Drehrate skaliert nicht mit dem Level.** Der heutige Wert bleibt Startwert.
3. Ist die Drohne gekickt und fliegt, wirkt der Schild nicht (wie bisher).

### Reflexion
4. **Der Schild reflektiert alle Projektile**, die ihn im Schildbogen treffen – die der Figur und die anderer Gegner (Geschützdrohne, Boss, Geschütze).
5. Reflektiert wird an der Schildfläche: Die Flugrichtung wird an der Blickrichtung des Schilds gespiegelt. Tempo, Schaden und verbleibende Flugdauer bleiben.
6. **Ein reflektiertes Projektil trifft danach jeden**, der im Weg ist: andere Gegner, die Figur, Geschütze, Minen, Fässer. Die Drohne, die es reflektiert hat, trifft es frühestens nach 0,15 s wieder.
7. Trifft ein reflektiertes Projektil die Figur, gelten die normalen Regeln: I-Frames und Schonzeit schützen. Projektile, die auf Höhe „hoch" fliegen (gegnerische Geschosse), lassen sich weiter unterducken; reflektierte Geschosse der Figur treffen auf jeder Höhe.
8. Einzelfälle je Waffe:

   | Projektil | am Schild |
   |---|---|
   | Pistole, MP, Schrot, Präzisionsgewehr, Kettenblitz | wird reflektiert |
   | Sägeblatt | wird reflektiert; verbraucht keinen seiner Wand-Abpraller |
   | Impulskanone | wird reflektiert; schleudert dann, wen sie trifft |
   | Granate | wird reflektiert, fliegt mit ihrer restlichen Flugdauer weiter und explodiert dort |
   | Flammenwerfer | wird nicht reflektiert, sondern verpufft am Schild |
   | Schwerlaser | kein Projektil – endet am Schild wie bisher |

9. **Punkte:** Tötet ein reflektiertes Projektil einen Gegner, zählt das als Umgebung (×2).

### Zerstörung
10. **Wird eine Schilddrohne zerstört, explodiert sie** – egal wodurch. Die Explosion macht festen Schaden an allen im Radius: Figur, Gegner, Geschütze; sie zündet Minen und Fässer.
11. Der Schaden ist ein fester Wert, der mit dem Level der Drohne skaliert (Schadensformel aus Aufgabe 01). Startwerte: Radius 90 px, Schaden 25 in Level 1, für Figur und Gegner gleich.
12. Fliegt die Drohne beim Tod als Wrack weiter, explodiert sie an der Stelle, an der sie stirbt, und das Wrack entfällt.
13. Die Explosion kündigt sich nicht an; sie folgt aus dem eigenen Kill. Die Figur entkommt ihr durch Abstand oder I-Frames.

### Spuren
14. **Die Explosion hinterlässt eine Spur am Boden.** Spuren bleiben für den Rest des Runs erhalten, aber nur in ihrem Level: Sie verschwinden nicht mit der Zeit und nicht, wenn die Aufgabe des Raums erfüllt ist, sondern erst beim Wechsel in den nächsten Raum.
15. Spuren sind zunächst nur sichtbar und haben keine Wirkung (siehe offene Fragen).
16. Spuren liegen unter allem anderen am Boden (über dem Bodenmuster, unter Bananen, Gegnern und der Figur).

## Umsetzungshinweise

- Geschosse der Figur (`g.bullets`) und gegnerische Geschosse (`g.shots`) sind heute zwei getrennte Listen mit getrennter Trefferlogik. Für Regel 6 braucht ein reflektiertes Projektil eine Kennzeichnung („reflektiert") und beide Listen müssen dann gegen beide Seiten prüfen. Ob das über ein gemeinsames Feld oder das Zusammenlegen der Listen geschieht, entscheidet die Umsetzung; die bestehenden Prüfungen für Schüsse dürfen dabei nicht brechen.
- Spuren als eigene Liste am Spielzustand (`g.marks` o. Ä.), die in `enterRoom` geleert und in `clearRoom` **nicht** geleert wird.
- Die Explosion läuft über die bestehende `explode`-Funktion mit eigener Art (`BlastKind`), damit sie ein eigenes Aussehen bekommen kann. Ein eigenes Bild `assets/fx/explosion-<art>.png` ist optional; ohne Bild greift die Umfärbung.

## Darstellung

- Ein reflektiertes Projektil ist als solches erkennbar (andere Farbe oder Umriss), weil es der Figur gefährlich wird.
- Am Schild blitzt beim Reflektieren kurz etwas auf.
- Die Spur ist ein dunkler Brandfleck in der Größe des Sprengradius, per Code gezeichnet.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- Ein Pistolenschuss von vorn auf den Schild kommt zurück und trifft die stehende Figur; die Drohne nimmt keinen Schaden.
- Derselbe Schuss von hinten trifft die Drohne normal.
- Ein reflektierter Schuss tötet einen zweiten Gegner, der hinter der Figur steht; der Kill zählt ×2.
- Ein Geschoss einer Geschützdrohne, das den Schild einer Schilddrohne trifft, wird reflektiert und kann die Geschützdrohne treffen.
- Die Drehrate des Schilds ist in Level 1 und Level 20 gleich.
- Eine zerstörte Schilddrohne verletzt die Figur in Reichweite mit dem skalierten Schaden und einen daneben stehenden Gegner ebenso; außerhalb des Radius passiert nichts.
- Nach der Explosion liegt eine Spur an der Stelle; sie ist nach 60 s Spielzeit noch da, nach erfüllter Aufgabe noch da, im nächsten Raum weg.
- Flammen werden am Schild nicht reflektiert; der Schwerlaser endet weiter am Schild.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Haben Spuren eine Wirkung (z. B. Schaden oder Verlangsamung beim Betreten) oder sind sie nur sichtbar? | nur sichtbar |
| Treffen reflektierte Geschosse der Figur auch die Figur selbst? | ja |
| Gibt ein Kill durch die Explosion der Schilddrohne Punkte, und wie viele? | ja, als Umgebung (×2), mit der Aktion des auslösenden Kills für den Mehrfach-Aufschlag |
| Explodiert die Drohne auch, wenn der Raum endet und sie mit allen anderen verschwindet? | nein, nur bei Zerstörung im Kampf |
| Lassen sich auch die Bodenfelder des Bosses oder Explosionen „reflektieren"? | nein, nur Projektile |

## Aufgefallen

(vom umsetzenden Agenten auszufüllen)
