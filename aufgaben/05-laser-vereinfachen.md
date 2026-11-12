# 05 – Laser vereinfachen

Status: offen

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

(vom umsetzenden Agenten auszufüllen)

## Übergabe an den Planer

(vom umsetzenden Agenten auszufüllen: umgesetzte und bewusst ausgelassene Regeln; neue Felder, Funktionen und Konstanten mit Datei; geänderte Prüfungen; was im Browser angesehen wurde)
