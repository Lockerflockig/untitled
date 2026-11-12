# Escape the Beams – Grundkonzept

Stand: Alle Mechanik-Stufen sind in erster Fassung gebaut. Als Nächstes kommt
die Stil-Phase (Art, Sprites, Animationen, Ton). Die Darstellung ist bis dahin
reiner Platzhalter.

- **[fest]** = von dir entschieden
- **[Vorschlag]** = von mir gefüllte Lücke, gebaut, aber nicht von dir bestätigt
- **[offen]** = noch zu entscheiden

Alle Zahlen sind Startwerte fürs Balancing und stehen jeweils oben in den
Dateien unter `src/sim/`.

## 1. Leitidee

Ein Arena-Actionspiel in Räumen, futuristisches Setting **[fest]**. Die Figur
weicht aus, dasht durch Gegner, kickt sie in Gefahren und schießt. Jeder Raum
hat eine Aufgabe; wie stilvoll man sie löst, bestimmt die Punkte. Punkte sind
die Währung für den Shop.

Vom Original bleiben die Arena, Laser als Teil der Umgebung und die Wände.
Das Fressen ist gestrichen; Dinge werden aufgehoben, die Figur wächst nicht **[fest]**.

## 2. Spielschleifen

| Ebene | Ablauf |
|---|---|
| Moment | bewegen, springen, ducken, dashen, kicken, schießen |
| Raum | Aufgabe erfüllen → Raum wird still, Ausgang öffnet sich → hinlaufen → nächster Raum |
| Run | Räume werden schwerer und lohnender, bis die Trefferpunkte aufgebraucht sind |
| Meta | Punkte im Shop ausgeben, Set wählen, neuer Run |

## 3. Die Spielfigur

### Bewegung **[fest]**
- Beschleunigt aus dem Stand, verliert in Kurven Tempo und schwingt aus, bremst beim Umkehren erst ab.
- Der Blickwinkel senkt das Höchsttempo um höchstens 15 % (rückwärts), und das sanft – damit man beim Weglaufen kurz umdrehen und schießen kann (Kiten).

### Springen, Ducken, Slide **[fest]**
Drei Höhen-Ebenen: Boden, Mitte, Oben.

| Zustand | Ebene | Wirkung |
|---|---|---|
| Stehen / Laufen | Mitte | normal |
| Ducken | Boden | langsam (40 %), weniger oder keine Streuung, weicht hohen Gefahren aus |
| Slide | Boden | Ducken ab 40 % des Höchsttempos: rutscht weiter, Strecke hängt vom Tempo ab |
| Springen | Oben | feste Flugdauer, Richtung in der Luft fest, Schießen erlaubt, weicht niedrigen Gefahren aus |

| Höhe der Gefahr | trifft | Ausweichen durch |
|---|---|---|
| niedrig | Stehen, Ducken, Slide | Springen, Dash |
| hoch | Stehen, Springen | Ducken, Slide, Dash |
| voll | alles | nur Dash |

Schüsse der Figur treffen Gegner auf allen Ebenen; die Höhe gilt nur fürs Ausweichen **[fest]**.

### Dash **[fest]**
- Immer in Mausrichtung, währenddessen unverwundbar (I-Frames).
- Macht Schaden an allem, worüber er geht – Dash ist der Nahkampf.
- Verbraucht eine Ladung; Ladungen füllen sich einzeln nach.

### Kick **[fest]**
- Schleudert alle Gegner im Bogen vor der Figur weg; Tempo und Flug sind bewusst überspitzt.
- Aufprall auf Wand, Geschütz oder einen anderen Gegner macht Schaden; ein Fass geht hoch.
- Gemeinsam gekickte Gegner fliegen zusammen und stoßen sich nicht.
- **Domino:** Ein fliegender Gegner gibt 80 % seines Schwungs an den getroffenen weiter, der dann selbst fliegt.
- **Wrack:** Stirbt ein Gegner im Flug, fliegt er als Wrack weiter und trifft andere.
- **Masse [Vorschlag]:** Schwere Gegner fliegen kürzer und stoßen leichte stärker weg.

### Waffen **[fest]**
Eine Standardwaffe, weitere im Shop, alle upgradebar. Keine Munition, nur
Abklingzeit (kann später neu entschieden werden). Streuung ist waffenabhängig;
bei der Pistole fällt sie nur auf weite Distanz ins Gewicht.

| Waffe **[Vorschlag]** | Charakter |
|---|---|
| Pistole (Standard) | einzelne Schüsse, mittlere Rate |
| Schrot | sechs Projektile im Fächer, kurze Reichweite |
| Schwerlaser | lädt kurz auf, dann brennt ein Strahl für einen Moment durch alle Gegner in einer Linie; hohe Abklingzeit, ein Schild-Mech von vorn hält ihn auf |
| Granate | Flächenschaden beim Einschlag; verletzt die Figur nicht |

### Trefferpunkte und Leben **[fest]**
- Trefferpunkte, im Shop hochstufbar. Keine Heilung im Raum.
- Extra-Leben im Shop, sehr teuer. **[Vorschlag]:** dauerhafte Stufen; ein Extra-Leben belebt an Ort und Stelle mit vollen Trefferpunkten, Druckwelle und Schonzeit wieder.
- Zwischen den Räumen gibt es ebenfalls keine Heilung **[Vorschlag]**.

## 4. Steuerung **[fest]**

| Aktion | Taste |
|---|---|
| Bewegen | WASD |
| Zielen | Maus |
| Schießen | linke Maustaste |
| Kick | rechte Maustaste |
| Dash | Shift |
| Springen | Leertaste |
| Ducken / Slide | C (Strg wäre intuitiver, aber Strg+W schließt den Browser-Tab) |
| Waffe wechseln | Q oder Mausrad |
| Pause | Esc |

Gamepad und Touch **[offen]**.

## 5. Gefahren

Grundregeln:
- Jede Gefahr kündigt sich sichtbar an, bevor sie Schaden macht.
- Gegner sind gegen Laser und Zielstrahl immun, außer sie werden hineingekickt **[fest]**.
- Explosionen und Bodenfelder treffen Gegner immer **[Vorschlag]** – dorthin kann man sie also auch locken.
- Die Laserhöhe ist an der Wand ablesbar: Austritt unten, oben oder über die ganze Wandhöhe **[fest als Platzhalter]**.

| Gefahr | Höhe | Verhalten | ab Raum |
|---|---|---|---|
| Sperrlaser | niedrig, hoch oder voll | eine Linie teilt den Raum für 3 s | 1 |
| Wanderlaser | niedrig oder hoch | eine Linie fährt von Wand zu Wand | 1 |
| Fass | voll | explodiert bei Schuss, Explosion oder Aufprall eines gekickten Gegners | 2 |
| Bodenfeld | niedrig | Fläche nahe der Figur leuchtet auf, löst nach 1 s aus | 3 |
| Mine | niedrig | zündet bei Annäherung; Überspringen löst sie nicht aus; abschießbar | 4 |
| Geschütz | schießt hoch | sitzt an der Wand, zerstörbar | 5 |
| Zielstrahl | hoch | verfolgt die Figur, rastet ein, feuert kurz | 6 |

Die drei alten Lasermuster (Rahmen, Käfig, Streuung) sind entfallen, weil sie
nur die Bewegung eingeschränkt haben **[fest]**.

## 6. Gegner

| Gegner **[Vorschlag]** | Verhalten | Konter | ab Raum |
|---|---|---|---|
| Jagddrohne | fliegt auf die Figur zu | alles; ideal zum Kicken | 1 |
| Geschützdrohne | hält Abstand, zielt sichtbar, schießt hoch | ducken, dann hin | 3 |
| Sprengdrohne | schnell, zündet nahe der Figur; detoniert auch abgeschossen | wegkicken oder auf Abstand abschießen | 4 |
| Schild-Mech | blockt Schüsse von vorn, dreht sich langsam | umlaufen, Dash, Kick, Granate | 6 |
| Schwerer Mech | viel Leben, viel Masse | Umgebung nutzen, Dauerfeuer | 7 |

Die Namen sind Arbeitstitel. Gegner kündigen ihr Erscheinen an.

## 7. Räume und Aufgaben **[fest]**

Aufgabe und Punkte sind getrennt. Ist die Aufgabe erfüllt, verschwinden Gegner
und Gefahren, der Ausgang in der rechten Wand öffnet sich, und die Figur rennt
in den nächsten Raum.

| Aufgabe **[Vorschlag]** | Zähler |
|---|---|
| Bananen | x Bananen aufheben |
| Säubern | x Gegner besiegen |
| Überleben | x Sekunden durchhalten |
| Geschütze | alle Geschütze zerstören |

Raumfolge **[Vorschlag]**: Raum 1 Bananen · 2 Säubern (Fässer) · 3 Bananen
(Geschützdrohne, Bodenfeld) · 4 Überleben (Sprengdrohne, Minen) · 5 Boss ·
6 Geschütze (Schild-Mech) · 7 Säubern (Schwerer Mech, Zielstrahl) · 8 Bananen.
Danach wechseln die Aufgaben reihum, alles wird dichter. Der Run ist endlos.

**Boss-Räume [Vorschlag]:** Jeder fünfte Raum. Der Boss ist ein Panzer: viel
Leben, praktisch nicht wegzukicken, rollt langsam auf die Figur zu. Er wechselt
zwei angekündigte Angriffe ab – ein Fächer hoher Geschosse (blauer Ring:
ducken) und drei Bodenfelder um die Figur (oranger Ring: springen). Dazu kommen
wenige Jagddrohnen. Jeder weitere Boss hat 50 % mehr Trefferpunkte.

## 8. Punkte und Multiplikatoren **[fest]**

    Punkte = Grundwert × Art × Serie × Raum

| Baustein | Wert **[Vorschlag]** |
|---|---|
| Grundwert | je Gegnertyp 100–400, Banane 50, Geschütz 150 |
| Art | Schuss ×1 · Dash ×1,5 · Kick ×1,5 · Umgebung (Wand, Laser, Aufprall, Explosion) ×2 |
| Mehrfach | +0,5 je weiterem Kill mit derselben Aktion (Kick samt Domino, Dash, Schrot, Schwerlaser, Granate) |
| Serie | +0,1 je Kill bis ×3; verfällt nach 4 s ohne Kill, fällt bei einem Treffer auf ×1 |
| Raum | ×1 in Raum 1, +0,25 je weiterem Raum |
| Raum geschafft | 500, ohne Treffer ×1,5 |

## 9. Shop und Ausrüstungs-Sets **[fest]**

Im Menü zwischen den Runs. Der Spieler startet nur mit den Basics (Pistole,
ein Dash, Kick); alles Weitere kommt durch Spielen und den Shop. Die Punkte
eines Runs werden am Ende gutgeschrieben.

| Bereich | Inhalte **[Vorschlag]** |
|---|---|
| Figur | Tempo, Aufheb-Reichweite, Trefferpunkte |
| Dash | Ladungen, I-Frames, Aufladung, Schaden |
| Kick | Wucht, Abklingzeit, Aufprallschaden |
| Leben | Extra-Leben |
| Waffen | freischalten, danach drei Schadensstufen |
| Module | Magnet, Nachbrenner, Schwerer Stiefel, Ruhige Hand, Panzerung, Taktgeber |

Ein Set besteht aus Hauptwaffe, Zweitwaffe und zwei Modulen. Es gibt drei
Sets; das gewählte gilt für den nächsten Run.

## 10. Stil-Phase (als Nächstes)

Stand:
- **Figur [fest]:** City Man (Variante 3, Anzug) in Seitenansicht, gespiegelt nach Zielrichtung, mit getrennt drehbarer Waffe. Cyborg und andere können später als Skin oder eigene Figur in den Shop.
- **Notlösungen, bis es eigene Animationen gibt:** Kick = Schlag, Sprung und Dash = ein Renn-Bild, Ducken = gestauchtes Bild, Slide = das Hechten-Bild aus der Tod-Animation.
- **Ton [fest]:** per Code erzeugte Platzhalter, ein Schuss-Sound für alle Waffen. Eigene Dateien lassen sich über `public/sounds/sounds.json` eintragen. Musik kommt später.
- **Darstellung bleibt vorerst Canvas 2D [Vorschlag]:** Sprites, Animationen und Ton gehen damit ohne Umbau. Phaser lohnt erst, wenn Partikel, Kamera oder Kacheln mehr verlangen.
- Assets liegen unter `public/assets/`. Sie stammen aus Craftpix-Paketen; vor einer Veröffentlichung des Quellcodes die Lizenz prüfen (https://craftpix.net/file-licenses/).

- **Gegner:** Sprites aus den Paketen Robots, Sci-Fi Antagonists und Factory Boss Enemies.
- **Räume [fest]:** Wände aus modernen Metallpaneelen mit Leuchtband, keine Ziegel. Der Boden ist ein Verlauf wie im Original; das Muster wechselt von Raum zu Raum (Raster, Platten, Arena-Ringe, schräge Bahnen), ebenso der Farbton. Raum 1 ist rot mit Raster wie das Original.
- **Explosionen:** Sprite-Animation aus dem Flame-Effects-Paket, stark verkleinert.

Vorgemerkt:
- Figur eventuell als futuristischer Humanoid in Pixel-Art, mit Animationen für Laufen, Umdrehen, Dash, Kick, Sprung, Slide.
- Die Höhe einer Gefahr muss ohne Beschriftung erkennbar sein, z. B. schwebender Strahl mit Schatten.
- Für Sprites, Partikel, Kamera und Ton auf Phaser wechseln; die Logik unter `src/sim/` bleibt, umzustellen sind Darstellung und Eingabe.

## 11. Technik

- TypeScript, Canvas 2D, Vite; ausgeliefert über nginx im Container (`docker compose up -d --build`, Port 8082).
- Logik mit festem Zeitschritt (120 Hz) unter `src/sim/`, ohne Canvas und DOM.
- Regelprüfungen ohne Browser: `npm test` (Node ab 22.6) rechnet `tests/rules.ts` durch.
- Zum Testen später Räume: `?raum=6` an die Adresse hängen. Solche Runs werden nicht gutgeschrieben.
