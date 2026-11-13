# 06 – Boss: Panzer mit neuem Moveset

Status: erledigt · baut auf 01 und 03 auf (Warnton)

## Ziel

Der Panzer bekommt drei benannte Fähigkeiten statt seines bisherigen
Verhaltens. Mit jedem Boss-Level kommt eine dazu: Level 5, 10 und 15.

## Ist-Zustand

- Typ `boss` in `src/sim/enemies.ts`: rollt langsam auf die Figur zu und wechselt zwei angekündigte Angriffe ab (Fächer hoher Geschosse, drei Bodenfelder).
- Erscheint in jedem fünften Raum; begleitet von wenigen Jagddrohnen.

## Regeln

### Grundsätzliches
1. **Der Panzer fährt nicht mehr von sich aus [fest, unter Vorbehalt].** Seine einzigen Bewegungen sind der Charge und der Sprung beim taktischen Rückzug. Das muss im Spiel getestet werden; die Stelle deshalb so bauen, dass sich ein langsames Fahren leicht wieder einschalten lässt (eine Konstante).
2. **Fähigkeiten je Boss-Level [fest]:**

   | Boss-Level | Fähigkeiten |
   |---|---|
   | 5 | Charge |
   | 10 | Charge, Call Backup |
   | 15 und höher | Charge, Call Backup, Taktischer Rückzug |

3. Der Panzer setzt seine Fähigkeiten nacheinander ein, mit einer Pause dazwischen (Startwert 1,5 s). Hat er mehrere, wechselt er sie ab; dieselbe kommt nicht zweimal hintereinander.
4. **Alle Werte skalieren** mit dem Level (Aufgabe 01): Leben und jeder Schaden. Dauern, Reichweiten und Tempo des Charge skalieren nicht.
5. **Die bisherigen Angriffe bleiben zusätzlich [fest]:** Fächer hoher Geschosse und drei Bodenfelder. Sie reihen sich in den Wechsel der Fähigkeiten ein wie eine weitere Fähigkeit; in Level 5 wechselt der Panzer also zwischen Charge, Fächer und Bodenfeldern.
6. **Einfärbung je Stufe [fest]:** Der Panzer ist leicht eingefärbt, damit man die Stufe erkennt – Level 5 grünlich, Level 10 lila, ab Level 15 rot.

### Charge
6. **Aufladen:** Der Panzer bleibt stehen und zeigt, wohin er fahren wird: eine Bahn in seiner Breite bis zur Wand, dazu eine Ladeleiste, die sich füllt. Dauer 1,2 s. Die Bahn folgt der Figur bis kurz vor Schluss und rastet in den letzten 0,3 s ein.
7. **Rasen:** Danach fährt er mit hoher Geschwindigkeit (Startwert 900 px/s) geradeaus die Bahn entlang bis zur Wand.
8. **Treffer:** Wen er überfährt, der nimmt Schaden (Startwert 35 in Level 1, Höhe „voll" – nur I-Frames schützen) und wird beiseite geschleudert. Das gilt auch für andere Gegner in der Bahn; für sie zählt es als Umgebung.
9. **Aufprall:** An der Wand bleibt er 1 s benommen stehen. In dieser Zeit setzt er keine Fähigkeit ein.

### Call Backup
10. **Der Panzer beschwört einen Sendemast in der Mitte des Raums.** Der Mast hat einen Anteil des maximalen Lebens des Panzers (Startwert 35 %, Bereich 25–50 %).
11. **Der Mast piept** – mit demselben Schleifen-Verhalten wie der Warnton der Sprengdrohne (Aufgabe 03), aber eigenem Ton (Name `pylon` in `sounds.json`).
12. **Nach 5 Sekunden ruft der Mast einen Schwarm:** Gegner erscheinen aus allen Richtungen am Rand des Raums. Anzahl mindestens 15, mit dem Level wachsend bis 20 und darüber (Startwert: 15 in Level 10, je weiteres Boss-Level +5).
13. **Wird der Mast vorher zerstört, kommt kein Schwarm.**
14. Der Mast lässt sich mit allem beschädigen, was auch Geschütze beschädigt. Er steht fest und greift nicht an.
15. Solange ein Mast steht oder ein Schwarm noch lebt, setzt der Panzer Call Backup nicht erneut ein.
16. Die Gegner des Schwarms kommen aus den Typen, die im jeweiligen Level erscheinen, mit den Werten dieses Levels. Sie zählen nicht gegen die sonstige Obergrenze für Gegner im Raum.

### Taktischer Rückzug
17. **Ankündigung:** 0,5 s lang zeigt der Panzer einen Kegel vor sich (Richtung zur Figur beim Auslösen, halber Öffnungswinkel 35°, Reichweite 350 px).
18. **Schuss:** Danach feuert er in diesen Kegel. Wer darin steht, nimmt Schaden (Startwert 25 in Level 1).
19. **Sprung:** Im selben Moment katapultiert er sich weg von der Stelle, an der die Figur stand, als er die Fähigkeit eingesetzt hat – in gerader Linie, bis zu 400 px weit oder bis zur Wand. Während des Sprungs trifft er niemanden.
20. Er löst die Fähigkeit bevorzugt aus, wenn die Figur näher als 250 px ist.

## Umsetzungshinweise

- Der Panzer braucht einen Zustand mit Phase und Zeit (z. B. `ruhen`, `charge-laden`, `charge-rasen`, `benommen`, `rueckzug-zeigen` …). Das heutige Feld `mode` reicht dafür nicht; ein eigenes Feld für den Boss-Zustand ist in Ordnung.
- Der Sendemast ist ein eigener Gegenstand am Spielzustand (wie die Geschütze), nicht ein Gegner: Er bewegt sich nicht, wird nicht gekickt und zählt nicht für „Säubern".
- Die Aufgabe „Boss besiegen" gilt als erfüllt, wenn der Panzer zerstört ist – unabhängig von Mast und Schwarm. Beides verschwindet dann mit dem Raum.
- `?raum=10` und `?raum=15` an der Adresse starten direkt in den jeweiligen Boss-Raum.

## Darstellung

- **Charge:** Bahn am Boden in Magenta (Farbe für „voll"), Ladeleiste über dem Panzer.
- **Sendemast:** per Code gezeichnet (Mast mit pulsierendem Ring), Lebensleiste, darüber die verbleibenden Sekunden bis zum Schwarm.
- **Schwarm:** die übliche Ankündigung der Gegner (Ring), am Rand des Raums.
- **Rückzug:** Kegel am Boden, der sich in 0,5 s füllt.
- **Einfärbung:** Das Sprite wird je Stufe leicht getönt (grünlich, lila, rot), ohne die Zeichnung zu überdecken; ohne Sprite hat der Ersatzkreis die Stufenfarbe.
- Der Name der laufenden Fähigkeit erscheint kurz über dem Panzer: „Chaaaarge!!!", „Call Backup!", „Taktischer Rückzug!!!".

## Abnahme-Prüfungen (in `tests/rules.ts`)

- In Level 5 setzt der Panzer neben Fächer und Bodenfeldern nur den Charge ein; in Level 10 auch Call Backup; in Level 15 alle drei.
- Die Stufenfarbe ist in Level 5, 10 und 15 jeweils eine andere; Level 20 hat die von Level 15.
- Zwischen den Fähigkeiten bewegt er sich nicht.
- Charge: Während des Aufladens gibt es keinen Schaden; danach wird die Figur in der Bahn getroffen, neben der Bahn nicht; ein Dash durch die Bahn schützt. Nach dem Aufprall ist er 1 s lang untätig.
- Call Backup: Der Mast steht in der Raummitte und hat 35 % des maximalen Lebens des Panzers. Nach 5 s erscheinen mindestens 15 Gegner. Wird der Mast vorher zerstört, erscheint keiner.
- Taktischer Rückzug: Nach 0,5 s nimmt die Figur im Kegel Schaden, außerhalb nicht; der Panzer steht danach weiter von der gemerkten Stelle entfernt als vorher.
- Schaden von Charge und Kegel ist in Level 15 höher als in Level 5.
- Ist der Panzer zerstört, gilt die Aufgabe als erfüllt, auch wenn Mast oder Schwarm noch da sind.

Die bestehenden Boss-Prüfungen beschreiben das alte Verhalten und werden ersetzt.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Bleiben die wenigen Jagddrohnen als Begleiter im Boss-Raum? | ja, wie bisher |
| Was passiert mit Boss-Räumen nach Level 15 (20, 25 …)? | derselbe Panzer mit allen drei Fähigkeiten, weiter skaliert |
| Trifft der Kegelschuss auch andere Gegner? | nein |

## Aufgefallen

- **Regelnummern doppelt:** „Einfärbung je Stufe" und „Charge – Aufladen" tragen beide die Nummer 6. Beide sind umgesetzt.
- **Benommen plus Pause:** Nach dem Aufprall ist er 1 s benommen (Regel 9) und macht *danach* noch die übliche Pause von 1,5 s – zusammen 2,5 s ohne Fähigkeit. Die Aufgabe lässt offen, ob die Benommenheit die Pause ersetzt; so gebaut, ist der Charge das Fenster zum Zurückschlagen. Umstellen: in `stepBoss` (Phase `stunned`) `rest(s)` durch `rest(s, 0)` ersetzen.
- **Mast nach dem Schwarm:** Der Mast verschwindet, sobald er den Schwarm gerufen hat (er ruft nur einmal). Regel 15 („solange ein Mast steht oder ein Schwarm noch lebt") deckt beide Fälle ab.
- **Mast gibt keine Punkte**, wenn er zerstört wird (anders als ein Geschütz mit 150). Die Aufgabe nennt keine; leicht nachzutragen in `stepPylon`.
- **Andere Gegner schieben den Panzer:** Das gegenseitige Auseinanderschieben der Gegner in `stepEnemies` achtet nicht auf die Masse. Ein Schwarm, der sich um den Panzer drängt, schiebt ihn deshalb ein paar Pixel; Explosionen und Treffer geben ihm (durch seine Masse kleinen) Rückstoß. Das ist keine eigene Bewegung und wie bei allen Gegnern; die Prüfung „bewegt sich nicht" sieht von diesen Schritten ab.
- **Charge und Kick:** Ein sehr starker Kick (über 1800 Kickkraft, z. B. Biker mit Upgrades) lässt den Panzer kurz als „gekickt" gelten; währenddessen ruht seine Fähigkeit (Zeit läuft nicht weiter). Wie bisher.
- **Überfahrene Gegner fliegen wie gekickt** (`kicked = true`, Schwung 1200 / Masse quer zur Bahn). Damit greifen Wand-Aufprall, Domino, Laser und der Sprengkick der Figur – eine Kombination im Sinne der Leitlinie, aber der Schaden daraus zählt mit dem Art-Multiplikator „Umgebung".
- **Kegel trifft unabhängig von der Höhe** (Springen und Ducken helfen nicht, nur I-Frames und Schonzeit), weil die Aufgabe keine Höhe nennt.
- **Schwarm in Level 10:** Mit 15 Gegnern (aus allen Typen bis Level 10, inklusive Sprengdrohnen) wird es sehr voll. Das ist nach Vorgabe; fürs Balancing nur als Hinweis.
- Das Feld `Enemy.mode` (zählte die Boss-Angriffe) ist entfallen; seine Aufgabe übernimmt `BossState.turn`. `Enemy.windup` und `Enemy.cooldown` nutzt der Panzer nicht mehr.
- Docker war in dieser Umgebung nicht erreichbar (kein Daemon); statt `docker compose up -d --build` lief dessen Build-Schritt `npm run build` (Typprüfung und Vite-Build) durch.

## Übergabe an den Planer

**Umgesetzt:** alle Regeln 1–20 einschließlich Darstellung; die drei offenen Fragen nach ihrer Vorgabe (Jagddrohnen bleiben als Begleiter, nach Level 15 derselbe Panzer weiter skaliert, Kegel trifft keine Gegner). Bewusst nichts ausgelassen.

**Neue Felder, Funktionen, Konstanten:**
- `src/sim/types.ts`: `BossAbility` (`charge` · `backup` · `retreat` · `fan` · `fields`), `BossState` (Phase, Zeit, laufende und letzte Fähigkeit, `turn`, Winkel, gemerkte Stelle, Sprungstart/-ziel, Getroffene des Charge, `callout`/`calloutT`), `Pylon`. Am Gegner: `boss: BossState | null`, `swarm: boolean`. Am Spiel: `pylon: Pylon | null`. Ankündigungen in `g.spawns` haben optional `swarm`. `AlarmKind` um `'pylon'` erweitert. `PlayerBeam.hit` kann auch den Mast enthalten.
- `src/sim/enemies.ts`:
  - Konstanten: `BOSS_DRIVE` (0 = fährt nicht; 1 = früheres langsames Fahren in den Pausen), `BOSS_FIRST` (2,5 s), `BOSS_PAUSE` (1,5 s), `BOSS_WINDUP` (0,7 s), `BOSS_CALLOUT`, `BOSS_TINTS`; Charge: `CHARGE_LOAD` (1,2), `CHARGE_LOCK` (0,3), `CHARGE_SPEED` (900), `CHARGE_DAMAGE` (35), `CHARGE_FLING` (700), `CHARGE_ENEMY_FLING` (1200), `CHARGE_STUN` (1); Call Backup: `PYLON_SHARE` (0,35), `PYLON_TIME` (5), `SWARM_BASE` (15), `SWARM_PER_BOSS` (5), `SWARM_INSET`; Rückzug: `RETREAT_SHOW` (0,5), `RETREAT_ARC` (35°), `RETREAT_RANGE` (350), `RETREAT_DAMAGE` (25), `RETREAT_JUMP` (400), `RETREAT_JUMP_TIME` (0,35), `RETREAT_NEAR` (250).
  - Funktionen: `bossTier(level)`, `bossTint(level)`, `bossAbilities(level)` (Reihenfolge = Wechsel), `swarmSize(level)`, `startAbility(g, e, ability)` (erzwingt eine Fähigkeit – auch für Prüfungen), `inRetreatCone(e, angle, x, y)`; intern `stepBoss`, `nextAbility`, `chargeRush`, `bossFan`, `bossFields`, `callSwarm`, `stepPylon`.
  - `alarmsOf` meldet `pylon`, solange ein Mast steht (Dringlichkeit steigt bis zum Schwarm).
  - `stepSpawns`: Schwarm-Gegner und -Ankündigungen zählen nicht gegen `maxEnemies`.
- `src/sim/core.ts`: `PYLON_R` (22), `damagePylon(g, amount)`; `explode` trifft den Mast.
- `src/sim/player.ts`: Geschosse, Strahl und Dash treffen den Mast (Geschosse bleiben an ihm hängen wie an einem Geschütz). In `src/sim/enemies.ts` trifft ihn ein gekickter Gegner wie ein Geschütz.
- `src/sim/game.ts`: `clearRoom` räumt den Mast weg; die Anfangspause des Panzers ist `BOSS_FIRST`.
- `src/audio.ts`: Platzhalter-Ton `pylon` (tiefer, fallender Ton, höher mit der Dringlichkeit). `public/sounds/LIESMICH.txt` nennt den Namen.
- `src/render.ts`: `drawBossGround` (Charge-Bahn, Kegel), `drawBossOverlay` (Ankündigungsring für Fächer/Felder, Ladeleiste, Name der Fähigkeit), Sendemast in `drawHazards`; Ersatzkreis in Stufenfarbe. `src/sprites.ts`: `tinted` tönt das Panzer-Sprite (35 % Stufenfarbe, nur auf nicht durchsichtigen Pixeln); Fahr-Animation nur bei Charge und Sprung.

**Geänderte Prüfungen:** Wie vorgegeben ersetzt: „Boss: steht im Raum, greift an, lässt sich nicht wegkicken" (prüfte das Zurollen) → „rollt nicht mehr auf die Figur zu und lässt sich nicht wegkicken". Die Prüfung zum Schaden von Boss-Geschossen und -Bodenfeldern bleibt inhaltlich gleich, erzwingt den Angriff jetzt aber über `startAbility` statt über das entfallene Feld `mode`. „Boss besiegt" nutzt den neuen Helfer `bossRoom` (ohne Begleiter und Gefahren), sonst unverändert. Neu (Abschnitt „Boss: Panzer"): Fähigkeiten je Level 5/10/15, kein Wiederholen, kein Call Backup bei stehendem Mast oder lebendem Schwarm, Stillstand zwischen den Fähigkeiten, Stufenfarben; Charge (kein Schaden beim Laden, Treffer in der Bahn, nicht daneben, Bahn folgt bis zum Einrasten, Dash schützt, Gegner in der Bahn, 1 s benommen, Level 15 > Level 5); Call Backup (Mast in der Mitte mit 35 %, Piepton, ≥ 15 Gegner nach 5 s rundum am Rand mit Level-Werten, nicht gegen die Obergrenze, 15/20/25 je Boss-Level, zerstört durch Schuss oder Dash → kein Schwarm); Rückzug (0,5 s ohne Schaden, Kegel trifft, außerhalb nicht, Sprung weg bis Wand bzw. höchstens 400 px, bevorzugt unter 250 px, Level 15 > Level 5); Panzer zerstört → Aufgabe erfüllt trotz Mast und Schwarm.

**Im Browser angesehen (Chromium, eigens gebaute Szenen über den echten Renderer, ohne Konsolenfehler):** Charge-Bahn beim Laden mit Ladeleiste und „Chaaaarge!!!" (Level 5), Sendemast mit Ring, Lebensleiste und Sekunden (Level 10), Kegel des Rückzugs mit „Taktischer Rückzug!!!" (Level 15), Ankündigungsringe des Schwarms rundum am Rand. Einmal mit dem Ersatzkreis (Stufenfarben grünlich, lila, rot) und einmal mit vorübergehend selbst gezeichneten Platzhalter-Sprites, um die Tönung zu sehen (wieder gelöscht). **Nicht** gesehen: das echte Panzer-Sprite (fehlt im Repository), der Ablauf in Bewegung im laufenden Spiel; **nicht** gehört: der Ton des Masts (kein Audiogerät).
