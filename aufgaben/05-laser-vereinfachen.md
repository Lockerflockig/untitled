# 05 – Laser vereinfachen

Status: erledigt

## Ziel

Vorbereitung darauf, Ducken und Springen später durch andere Mechaniken
(Parry, Fähigkeit) zu ersetzen: Die Laser, die man überspringt oder
unterduckt, entfallen. Es bleibt nur der Laser, der alles trifft.

## Ist-Zustand

- `spawnLaser` in `src/sim/hazards.ts` erzeugt zur Hälfte Wanderlaser (niedrig oder hoch) und zur Hälfte Sperrlaser (niedrig, hoch oder voll).
- Die Höhe wird an der Wand und per Farbe und Beschriftung angezeigt (`src/render.ts`).

## Regeln

1. **Es gibt nur noch Laser der Höhe „voll".** Niedrige und hohe Laser entfallen.
2. **Zwei Arten bleiben:** statisch (Sperrlaser, steht für seine Dauer an einer Stelle) und beweglich (Wanderlaser, fährt von Wand zu Wand).
3. **Verhältnis statisch zu beweglich 3 : 1.**
4. Vorwarnung, Dauer, Tempo, Schaden und die Regel, dass Gegner nur gekickt getroffen werden, bleiben unverändert.
5. **Nicht Teil dieser Aufgabe:** Springen, Ducken, Slide und die Höhen der übrigen Gefahren (Bodenfeld, Mine, Geschütz, Zielstrahl, gegnerische Geschosse) bleiben bestehen, bis ihre Ersatz-Mechaniken feststehen.

## Darstellung

- Die Beschriftung am Laser („NIEDRIG · springen" usw.) entfällt, weil es nur noch eine Art gibt.
- Der Austritt an der Wand geht immer über die ganze Wandhöhe.

## Abnahme-Prüfungen (in `tests/rules.ts`)

- Aus 400 erzeugten Lasern hat jeder die Höhe „voll".
- Der Anteil beweglicher Laser liegt bei rund einem Viertel (zwischen 18 und 32 %).
- Ein beweglicher Laser trifft die stehende, die geduckte und die springende Figur; nur I-Frames schützen.

Die bestehenden Prüfungen zu niedrigen und hohen Lasern bleiben, solange `heightHits` für andere Gefahren gebraucht wird; sie setzen ihre Laser von Hand.

## Offene Fragen

| Frage | Vorgabe, nach der gebaut wird |
|---|---|
| Ein beweglicher Laser, der alles trifft, lässt sich nur per Dash überwinden. Soll sein Tempo deshalb sinken oder die Vorwarnung steigen? | nein, unverändert; später im Balancing |

## Aufgefallen

- Ein beweglicher Laser (200 px/s, nur per Dash zu überwinden) ist jetzt im Verhältnis härter als vorher, weil man ihn nicht mehr überspringen oder unterducken kann. Das Tempo und die Vorwarnung bleiben laut Vorgabe der offenen Frage unverändert; das Balancing steht noch aus.
- `Laser.height` (`src/sim/types.ts`) und `heightHits` bleiben bestehen: Die Prüfungen „Laser-Höhen" setzen niedrige und hohe Laser von Hand, und die übrigen Gefahren brauchen `heightHits` weiter. `spawnLaser` erzeugt aber nur noch `'full'`.
- Die Wandhöhen-Spannen im Renderer (unten/oben) sind mit der Beschriftung entfernt, weil kein Laser sie mehr braucht. Die Farbe kommt weiter aus `HEIGHT_COLOR[l.height]` (Magenta für „voll").
- Die Prüfung des Anteils beweglicher Laser läuft mit einem festen Zufallsstrom (Seed in der Prüfung), damit sie nicht gelegentlich zufällig aus dem Bereich von 18–32 % fällt; ohne Seed hätte sie bei 400 Lasern etwa eine Chance von 1 zu 800 auf einen falschen Alarm.

## Übergabe an den Planer

**Umgesetzt:** Regeln 1–5 vollständig, Darstellung wie beschrieben. Springen, Ducken, Slide und die Höhen der übrigen Gefahren sind unangetastet.

**Neue Felder, Funktionen, Konstanten:**
- `src/sim/hazards.ts`: `spawnLaser` ist jetzt exportiert (für Prüfungen), `LASER_MOVING_SHARE` (0,25 = 3 : 1). Beide Laserarten setzen `height: 'full'`; Vorwarnung, Dauer, Tempo und Schaden sind unverändert.
- `src/render.ts`: `HEIGHT_LABEL` und `EMITTER_SPAN` entfallen; der Austritt geht immer über die ganze Wandhöhe, keine Beschriftung am Laser.

**Geänderte Prüfungen:** keine. Die bestehenden „Laser-Höhen"-Prüfungen bleiben, wie die Aufgabe es verlangt. Neu: Abschnitt „Laser: nur noch ‚voll'" in `tests/rules.ts` (400 Laser alle „voll", Anteil beweglicher Laser 18–32 %, Vorwarnung/Dauer/Tempo unverändert, beweglicher Laser trifft stehende, geduckte und springende Figur, nur der Dash schützt). Mutationsprobe: Mit Anteil 50 % oder einem Wanderlaser der Höhe „niedrig" schlägt die jeweilige Prüfung an.

**Im Browser angesehen (Chromium):** Eine eigens gezeichnete Szene mit einem scharfen Sperrlaser, einem scharfen Wanderlaser und einem Sperrlaser in der Vorwarnung: alle magenta, der Austritt reicht an den Wänden über die ganze Höhe, keine Beschriftung mehr.
