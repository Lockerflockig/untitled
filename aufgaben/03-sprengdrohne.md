# 03 – Sprengdrohne (Kamikaze)

Status: erledigt · baut auf 01 auf

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

- **Die Sprengdrohne verschwindet auch dann ohne Explosion, wenn sie im Flug stirbt** (etwa beim Aufprall an der Wand), und lässt kein Wrack zurück. Das folgt aus Regel 2 („verschwindet sie ohne Explosion") und ist hier so gebaut. Ein gekickter Gegner, der vor der Wand zerstört wird, fliegt also nicht als Wrack weiter.
- Stirbt die Drohne im selben Schritt durch Schaden, in dem ihre Lunte abläuft, gewinnt der Schaden (`hp > 0` in der Lunten-Prüfung): Punkte, keine Explosion.
- In `ENEMIES.bomber` stehen `speed` und `speedMax` jetzt auf 0 (Kommentar im Code), weil ihr Tempo nicht aus der Tabelle kommt. Die Tabelle in Aufgabe 01 nannte 225 → 290; das ist durch Regel 1 dieser Aufgabe überholt. `enemyStats('bomber', n).speed` ist deshalb immer 0 und wird nirgends gelesen.
- Der Warnton piept nur, solange die Sprengdrohne die Figur *jagt*. Während der Ankündigung (Ring am Boden, `g.spawns`) ist er noch aus; erst die Drohne selbst löst ihn aus.
- Ein im Raum liegender Piepton endet sofort (auch der Platzhalter-Oszillator wird gestoppt), aber der Dauerton wird in Pausen nicht fortgesetzt „wie ein Loop", sondern beginnt beim Weiterspielen mit einem frischen Piepton.
- Die Dringlichkeit ist 0 solange die Lunte nicht brennt und steigt dann von 0,5 auf 1. Sie hängt nicht vom Abstand ab.
- Docker war in dieser Umgebung nicht erreichbar; statt `docker compose up -d --build` lief dessen Build-Schritt `npm run build` (Typprüfung und Vite-Build) durch.

## Übergabe an den Planer

**Umgesetzt:** Regeln 1–12 vollständig. Die Vorgabe der offenen Frage ist eingehalten (mit laufender Lunte getötet: auch dann keine Explosion).

**Neue Felder, Funktionen, Konstanten:**
- `src/sim/enemies.ts`: `BOMB_SPEED` (1,5), `BOMB_RADIUS` (160, jetzt exportiert), `alarmsOf(g)` – liefert die Dauertöne, die jetzt laufen sollen (`Alarm[]`). Die Todes-Behandlung der Sprengdrohne explodiert nur bei `e.suicide`.
- `src/sim/types.ts`: `AlarmKind` (`'beep'`), `Alarm { kind, urgency }` (Dringlichkeit 0…1).
- `src/alarmLoop.ts` (neu): `AlarmLoops` (reine Zeitlogik ohne Ton: `update(active, now, loops)` liefert `beep`/`stop`-Befehle), `ALARM_INTERVAL` (0,7 s ruhig … 0,14 s höchste Dringlichkeit).
- `src/audio.ts`: `setAlarms(alarms)`, `ALARM_SYNTH` (Platzhalter-Piepton, höher mit der Dringlichkeit); `sounds.json` kennt für jeden Eintrag auch `{ "datei": …, "schleife": … }`; `loopSetting` hält die Einstellung je Ton.
- `src/main.ts` ruft jeden Frame `setAlarms(screen === 'playing' ? alarmsOf(game) : [])` auf – außerhalb des Spiels (Pause, Beute-Auswahl, Spielende, Menü) ist die Liste leer, der Ton endet sofort.
- `public/sounds/LIESMICH.txt`: Name `beep`, Objektform und `schleife`.

**Für den Sendemast (Aufgabe 06):** `AlarmKind` um `'pylon'` erweitern, in `alarmsOf` die Bedingung eintragen, in `ALARM_SYNTH` den Platzhalter ergänzen. `AlarmLoops` und `setAlarms` brauchen keine Änderung.

**Geänderte Prüfungen:** „Abgeschossene Sprengdrohne reißt Nachbarn mit" ist wie vorgegeben ersetzt (jetzt: explodiert nicht, Nachbar und Figur unverletzt, Punkte gibt es). Sonst nichts. Neu in `tests/rules.ts`: Tempo (1,5 ×, mit Upgrade, Level 1 und 20), Tod im Flug trotz Lunte, Lunte läuft ab (150 px trifft, 180 px nicht; keine Punkte), Schaden Level 6 gegen Level 1 (Figur 30 → 40, Gegner 40 → 54), gekickt mit Lunte (brennt weiter, Explosion am Ziel, Kill ×2), Alarm-Zustand, Schleife (Takt, Dringlichkeit, sofortiges Ende, Schleife aus).

**Im Browser angesehen (Chromium):**
- Eine eigens gezeichnete Szene mit zwei Sprengdrohnen: Der Ring, der die Zeit bis zur Zündung zeigt, wächst bis zum neuen Radius von 160 px (zu gut der Hälfte und kurz vor der Explosion angesehen).
- Die echte Ton-Schleife in `src/audio.ts` mit einem echten `AudioContext`, gezählt an den erzeugten Oszillatoren: ruhig 3 Pieptöne in 2 s, dringlich 7 in 1 s, in der Stille keiner; mit `{ "beep": { "schleife": false } }` in der `sounds.json` genau ein Piepton je Angehen. Der Browser lief ohne Konsolenfehler.
- **Nicht** gehört: wie der Ton klingt (kein Audiogerät in dieser Umgebung), und nicht gesehen: das Sprite der Sprengdrohne (Bilder fehlen im Repository).
