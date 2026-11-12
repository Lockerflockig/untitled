# 03 – Sprengdrohne (Kamikaze)

Status: offen · baut auf 01 auf

## Ziel

Die Sprengdrohne wird zur echten Bedrohung, der man nicht davonlaufen kann:
schneller als die Figur, mit Warnton, mit doppeltem Sprengradius. Wer sie
rechtzeitig tötet, wird belohnt – dann explodiert sie nicht.

## Ist-Zustand

- Typ `bomber` in `src/sim/core.ts`; Verhalten in `src/sim/enemies.ts`.
- Tempo 225 px/s, zündet bei 70 px Abstand eine Lunte von 0,6 s, Sprengradius 80 px.
- Sie detoniert immer – auch abgeschossen oder weggekickt.

## Regeln

1. **Tempo: das 1,5-fache des Tempos der Figur [fest].** Die Sprengdrohne ist immer schneller als die Figur. Maßgeblich ist das aktuelle Höchsttempo der Figur (`g.stats.speed`, also einschließlich Upgrades und Charakter). Das Tempo der Sprengdrohne skaliert deshalb **nicht** mit dem Level und hat keine eigene Obergrenze.
2. **Keine Explosion, wenn die Figur sie tötet.** Stirbt die Sprengdrohne durch Schaden, bevor ihre Lunte abläuft, verschwindet sie ohne Explosion. Das gilt für jede Schadensquelle (Schuss, Dash, Kick, Aufprall, Laser nach Kick, fremde Explosion). Punkte gibt es wie bisher.
3. **Explosion nur durch die eigene Lunte.** Läuft die Lunte ab, explodiert sie wie bisher und gibt keine Punkte.
4. **Sprengradius verdoppelt:** 160 px statt 80 px. Der Auslöse-Abstand (70 px) und die Lunte (0,6 s) bleiben.
5. **Schaden** skaliert mit dem Level der Drohne (Aufgabe 01). Leben skaliert ebenfalls.
6. **Gekickt mit laufender Lunte:** Die Lunte läuft im Flug weiter (wie bisher). Explodiert sie am Ziel, zählen getroffene Gegner als Umgebung (×2).

### Warnton

7. **Solange mindestens eine Sprengdrohne auf die Figur zuläuft, ertönt ein Piepton.** „Zuläuft" heißt: Sie ist im Raum, lebt, ist nicht gekickt.
8. Der Ton ist **austauschbar** über `public/sounds/sounds.json` wie alle anderen (Name `beep`). Ohne eigene Datei gibt es einen per Code erzeugten Piepton.
9. **Der Ton läuft als Schleife**, solange die Bedingung gilt, und endet sofort, wenn sie nicht mehr gilt (auch bei Pause, Beute-Auswahl und Spielende).
10. **Die Schleife lässt sich ausschalten – je Ton in `sounds.json` [fest].** Dann ertönt der Ton nur einmal, wenn die erste Sprengdrohne erscheint.
11. Mit laufender Lunte wird der Piepton schneller oder höher, damit man die Zündung hört.
12. Die Schleifen-Logik wird so gebaut, dass weitere Quellen sie mit eigenem Ton nutzen können (der Sendemast des Bosses in Aufgabe 06).

## Umsetzungshinweise

- Die Logik sammelt nur Ereignisse (`g.events`). Für einen Dauerton reicht das nicht: Die Logik braucht einen abfragbaren Zustand (z. B. `g.alarms` mit Art und Dringlichkeit), den `src/main.ts` jeden Frame an `src/audio.ts` weitergibt. `audio.ts` startet und stoppt die Schleife.
- Das Ausschalten der Schleife: in `sounds.json` je Eintrag erlauben, statt eines Dateinamens ein Objekt anzugeben, z. B. `{ "datei": "piep.wav", "schleife": false }`. `public/sounds/LIESMICH.txt` entsprechend ergänzen.

## Darstellung

- Der Ring, der den Sprengradius zeigt, wächst auf den neuen Radius.
- Kein neues Bild nötig.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- Das Tempo einer Sprengdrohne ist das 1,5-fache von `g.stats.speed`, auch mit Tempo-Upgrade, und in Level 1 und Level 20 gleich.
- Eine abgeschossene Sprengdrohne explodiert nicht: Ein Gegner direkt daneben nimmt keinen Schaden, es gibt Punkte.
- Eine Sprengdrohne, deren Lunte abläuft, trifft die Figur in 150 px Abstand; in 180 px Abstand nicht.
- Der Explosionsschaden in Level 6 ist höher als in Level 1.
- Der Alarm-Zustand ist aktiv, solange eine Sprengdrohne lebt und nicht gekickt ist, und sonst aus.

Die bestehende Prüfung „Abgeschossene Sprengdrohne reißt Nachbarn mit" beschreibt das alte Verhalten und wird durch die neue ersetzt.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Explodiert sie auch dann nicht, wenn sie mit laufender Lunte getötet wird? | richtig, dann auch nicht |

## Aufgefallen

(vom umsetzenden Agenten auszufüllen)
