# 06 – Boss: Panzer mit neuem Moveset

Status: offen · baut auf 01 und 03 auf (Warnton)

## Ziel

Der Panzer bekommt drei benannte Fähigkeiten statt seines bisherigen
Verhaltens. Mit jedem Boss-Level kommt eine dazu: Level 5, 10 und 15.

## Ist-Zustand

- Typ `boss` in `src/sim/enemies.ts`: rollt langsam auf die Figur zu und wechselt zwei angekündigte Angriffe ab (Fächer hoher Geschosse, drei Bodenfelder).
- Erscheint in jedem fünften Raum; begleitet von wenigen Jagddrohnen.

## Regeln

### Grundsätzliches
1. **Der Panzer fährt nicht mehr von sich aus.** Seine einzigen Bewegungen sind der Charge und der Sprung beim taktischen Rückzug.
2. **Fähigkeiten je Boss-Level:**

   | Boss-Level | Fähigkeiten |
   |---|---|
   | 5 | Charge |
   | 10 | Charge, Call Backup |
   | 15 und höher | Charge, Call Backup, Taktischer Rückzug |

3. Der Panzer setzt seine Fähigkeiten nacheinander ein, mit einer Pause dazwischen (Startwert 1,5 s). Hat er mehrere, wechselt er sie ab; dieselbe kommt nicht zweimal hintereinander.
4. **Alle Werte skalieren** mit dem Level (Aufgabe 01): Leben und jeder Schaden. Dauern, Reichweiten und Tempo des Charge skalieren nicht.
5. Der bisherige Fächer und die Bodenfelder entfallen (siehe offene Fragen).

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
- Der Name der laufenden Fähigkeit erscheint kurz über dem Panzer: „Chaaaarge!!!", „Call Backup!", „Taktischer Rückzug!!!".

## Abnahme-Prüfungen (in `tests/rules.ts`)

- In Level 5 setzt der Panzer nur den Charge ein; in Level 10 auch Call Backup; in Level 15 alle drei.
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
| Kommt je Boss-Level eine Fähigkeit dazu, oder hat der Panzer ab Level 5 alle drei? | je Boss-Level eine dazu |
| Entfallen der alte Fächer und die Bodenfelder ganz? | ja |
| In Level 5 hat der Panzer nur den Charge. Ist das genug, oder braucht er dort einen zweiten Angriff? | genug, zusammen mit den Begleitern |
| Bleiben die wenigen Jagddrohnen als Begleiter im Boss-Raum? | ja, wie bisher |
| Was passiert mit Boss-Räumen nach Level 15 (20, 25 …)? | derselbe Panzer mit allen drei Fähigkeiten, weiter skaliert |
| Trifft der Kegelschuss auch andere Gegner? | nein |

## Aufgefallen

(vom umsetzenden Agenten auszufüllen)
