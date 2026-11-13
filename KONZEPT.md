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
| Schwerlaser | lädt kurz auf, dann brennt ein Strahl für einen Moment durch alle Gegner in einer Linie; hohe Abklingzeit, eine Schilddrohne von vorn hält ihn auf |
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
- Laser haben nur noch die Höhe „voll" **[fest]**: Springen und Ducken helfen nicht, nur der Dash (I-Frames) schützt. Der Austritt an der Wand geht immer über die ganze Wandhöhe. Das bereitet vor, Ducken und Springen später zu ersetzen; die übrigen Gefahren behalten vorerst ihre Höhen.

| Gefahr | Höhe | Verhalten | ab Raum |
|---|---|---|---|
| Sperrlaser | voll | eine Linie teilt den Raum für 3 s | 1 |
| Wanderlaser | voll | eine Linie fährt von Wand zu Wand; ein Viertel der Laser, der Rest sind Sperrlaser (3 : 1) | 1 |
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
| Jagddrohne | fliegt auf die Figur zu und schlägt mit Angriffsanimation (kein Berührungsschaden) | aus dem Bogen laufen, Dash; Kick oder Treffer unterbrechen; ideal zum Kicken | 1 |
| Geschützdrohne | hält Abstand, zielt sichtbar, schießt hoch | ducken, dann hin | 3 |
| Sprengdrohne | läuft mit dem 1,5-fachen Tempo der Figur zu, zündet nahe der Figur, Warnton; explodiert nur durch ihre Lunte | rechtzeitig abschießen oder wegkicken (dann keine Explosion) | 4 |
| Schilddrohne | blockt Schüsse von vorn, richtet den Schild langsam zur Figur aus; explodiert beim Zerstören | umlaufen, Dash, Kick, Granate; Abstand zur Explosion halten | 6 |
| Schwerer Mech | viel Leben, viel Masse | Umgebung nutzen, Dauerfeuer | 7 |

Die Namen sind Arbeitstitel. Gegner kündigen ihr Erscheinen an.

**Jagddrohne:** Sie verletzt nicht mehr durch Berührung. Sobald die Figur in
Reichweite ist (50 px ab Rand der Drohne, der Körper der Figur zählt), bleibt
sie stehen und holt 0,35 s aus; die Richtung steht zu Beginn fest, und am Boden
ist der Bogen angedeutet (halber Öffnungswinkel 60°). Danach schlägt sie einmal:
Wer im Bogen steht, nimmt Schaden (alle Höhen; I-Frames und Schonzeit schützen
wie sonst). Dann steht sie 0,5 s und kann nicht angreifen. Wer während des
Ausholens aus dem Bogen läuft, dasht oder die Drohne wegkickt, wird nicht
getroffen; ein Kick oder jeder Treffer mit Rückstoß bricht das Ausholen ab.
Gekickte Drohnen greifen nicht an. Dauer, Reichweite und Winkel skalieren nicht
mit dem Level, Leben, Schaden und Tempo (höchstens 250 px/s) schon. Der Angriff
ist als Baustein gebaut (`MELEE` in `src/sim/enemies.ts`), damit Schilddrohne
und Schwerer Mech ihn später mit eigenen Werten übernehmen können; bis dahin
verletzen sie noch durch Berührung.

**Schilddrohne:** Ihr Schild dreht sich mit fester Rate (2,2 rad/s, skaliert
nicht mit dem Level) zur Figur; Schüsse von vorn schluckt er vorerst, später
soll er sie reflektieren. Wird sie zerstört – egal wodurch, auch im Flug –,
explodiert sie ohne Ankündigung: Radius 90 px, 25 Schaden in Level 1 (wächst mit
dem Level) für Figur und Gegner, zündet Minen und Fässer, ein Wrack bleibt nicht.
Kills durch diese Explosion zählen als Umgebung (×2). Sie hinterlässt einen
dunklen Brandfleck am Boden, der bis zum Wechsel in den nächsten Raum liegen
bleibt (auch nach erfüllter Aufgabe) und vorerst nur zu sehen ist. Löst sich
der Raum auf, weil die Aufgabe erfüllt ist, explodiert keine Drohne.

**Sprengdrohne:** Sie läuft immer mit dem 1,5-fachen Höchsttempo der Figur
(einschließlich Upgrades und Charakter) auf sie zu; ihr Tempo skaliert nicht
mit dem Level. Nahe der Figur (70 px) zündet sie eine Lunte von 0,6 s und
explodiert dann mit Radius 160 px; der Schaden wächst mit dem Level. Wer sie
vorher zerstört – Schuss, Dash, Kick, Aufprall, fremde Explosion –, bekommt die
Punkte, und sie verschwindet ohne Explosion. Eine gekickte Drohne mit brennender
Lunte brennt im Flug weiter und explodiert am Ziel; getroffene Gegner zählen
als Umgebung (×2). Solange mindestens eine Sprengdrohne auf die Figur
zuläuft (im Raum, lebt, nicht gekickt), piept ein Warnton als Schleife; er
wird schneller und höher, sobald eine Lunte brennt. Der Ton ist über
`public/sounds/sounds.json` austauschbar (Name `beep`) und die Schleife je Ton
abschaltbar.

### Skalierung mit dem Level **[fest]**

Level ist die Raumnummer. Jeder Gegner bekommt beim Erscheinen Werte, die mit
dem Level exponentiell wachsen und danach unverändert bleiben:

| Wert | Wachstum je Level | Level 10 | Level 20 |
|---|---|---|---|
| Leben | ×1,10 | ×2,4 | ×6,1 |
| Schaden | ×1,06 | ×1,7 | ×3,0 |
| Tempo | ×1,03, begrenzt je Typ | | |

Der Schaden gilt für jeden Angriff des Gegners (Berührung, Geschosse,
Explosion). Das Tempo hat je Typ eine harte Obergrenze, damit kein Verfolger
dauerhaft schneller wird als die Figur ohne Upgrades (300 px/s): Jagddrohne
250, Geschützdrohne 170, Schild 190, Schwerer Mech 130, Boss 80. (Die
Sprengdrohne hat keine eigene Grenze: Ihr Tempo hängt am Tempo der Figur,
siehe unten.)
Radius, Masse und Punkte skalieren nicht; Gefahren im Raum (Laser, Minen,
Fässer, Geschütze, Bodenfelder, Zielstrahl) auch nicht. Welche Typen erscheinen,
wie viele gleichzeitig da sind und wie schnell sie nachkommen, steht in
`roomPlan` (`src/sim/game.ts`). **Der Boss skaliert wie alle** über sein Level
(die Raumnummer): Sein Grundwert für Leben (615) ist so gewählt, dass der erste
Boss in Raum 5 wieder 900 Trefferpunkte hat. Das gilt auch für seinen Schaden
(Berührung, Geschosse, Bodenfelder, Charge, Kegelschuss).

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
6 Geschütze (Schilddrohne) · 7 Säubern (Schwerer Mech, Zielstrahl) · 8 Bananen.
Danach wechseln die Aufgaben reihum, alles wird dichter. Der Run ist endlos.

**Boss-Räume [Vorschlag]:** Jeder fünfte Raum. Der Boss ist ein Panzer: viel
Leben, praktisch nicht wegzukicken. Dazu kommen wenige Jagddrohnen. Der Boss
skaliert wie alle Gegner mit seinem Level (Raumnummer): Der erste in Raum 5 hat
900 Trefferpunkte, der in Raum 10 rund 1450; jeder seiner Schäden wächst mit
(Dauern, Reichweiten und das Tempo des Charge nicht).

**Panzer: Moveset [fest]:** Er fährt nicht von sich aus (unter Vorbehalt – eine
Konstante, `BOSS_DRIVE`, schaltet langsames Fahren wieder ein); er bewegt sich
nur beim Charge und beim Rückzugssprung. Er setzt seine Fähigkeiten reihum ein,
mit 1,5 s Pause dazwischen, nie zweimal dieselbe hintereinander. Mit jedem
Boss-Level kommt eine dazu, die Stufe erkennt man an der Tönung:

| Boss-Level | Fähigkeiten | Tönung |
|---|---|---|
| 5 | Charge | grünlich |
| 10 | Charge, Call Backup | lila |
| 15 und höher | Charge, Call Backup, Taktischer Rückzug | rot |

Die beiden alten Angriffe bleiben und reihen sich wie Fähigkeiten ein: ein
Fächer hoher Geschosse (blauer Ring: ducken) und drei Bodenfelder um die Figur
(oranger Ring: springen). Der Name einer Fähigkeit erscheint kurz über ihm.

- **Charge („Chaaaarge!!!"):** 1,2 s Aufladen – er steht, eine magentafarbene
  Bahn in seiner Breite zeigt bis zur Wand, eine Ladeleiste füllt sich. Die Bahn
  folgt der Figur und rastet 0,3 s vor Schluss ein. Dann rast er mit 900 px/s bis
  zur Wand. Wen er überfährt, nimmt Schaden (35 in Level 1, Höhe „voll" – nur
  I-Frames schützen) und wird beiseite geschleudert; Gegner in der Bahn ebenso
  (als Umgebung). An der Wand ist er 1 s benommen, danach folgt die Pause.
- **Call Backup („Call Backup!"):** Ein Sendemast erscheint in der Raummitte, mit
  35 % des maximalen Lebens des Panzers. Er piept (Dauerton `pylon`), steht fest
  und greift nicht an; man beschädigt ihn mit allem, was auch Geschütze trifft.
  Nach 5 s ruft er einen Schwarm und verschwindet: Gegner der Typen und Werte
  dieses Levels erscheinen rundum am Rand (15 in Level 10, je weiteres
  Boss-Level 5 mehr); sie zählen nicht gegen die Obergrenze des Raums. Wird der
  Mast vorher zerstört, kommt kein Schwarm. Solange ein Mast steht oder ein
  Schwarm lebt, kommt kein neues Call Backup.
- **Taktischer Rückzug („Taktischer Rückzug!!!"):** 0,5 s lang füllt sich ein
  Kegel vor ihm (zur Figur, ±35°, 350 px). Dann schießt er hinein (25 Schaden in
  Level 1, nur an der Figur) und springt im selben Moment in gerader Linie weg
  von der Stelle, an der die Figur beim Auslösen stand – bis 400 px oder zur
  Wand; im Sprung trifft er niemanden. Ist die Figur näher als 250 px, setzt er
  den Rückzug bevorzugt ein.

Ist der Panzer zerstört, ist die Aufgabe erfüllt; Mast und Schwarm verschwinden
mit dem Raum.

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

## 9a. Charaktere und Drops (Entwurf, noch nicht gebaut)

Deine Richtung **[fest]**: Waffen und Module hängen künftig zum Teil am
Charakter und zum Teil an Drops im Run, statt frei im Shop gekauft und in Sets
kombiniert zu werden. Dazu mehr Waffen und Module. Alles Weitere in diesem
Abschnitt ist **[Vorschlag]** und würde Abschnitt 9 ersetzen.

### Was wo herkommt

| Quelle | Was sie liefert | Bleibt es? |
|---|---|---|
| Charakter | Startwaffe, eine Eigenheit, Grundwerte | dauerhaft freigeschaltet |
| Drops im Run | weitere Waffen, Module, Stufen dafür | nur für diesen Run |
| Shop | Charaktere, Grundwert-Upgrades, neue Einträge für den Drop-Vorrat | dauerhaft |

Die Ausrüstungs-Sets entfallen; die Wahl vor dem Run ist der Charakter.

### Charaktere

| Charakter | Sprite | Startwaffe | Eigenheit | Grundwerte |
|---|---|---|---|---|
| Agent | City Man im Anzug | Pistole | keine Streuung im Stand | ausgewogen |
| Cyborg | Cyborg | Schwerlaser | zwei Dash-Ladungen | weniger Trefferpunkte |
| Biker | Biker | Schrot | Kick mit mehr Wucht | mehr Trefferpunkte, langsamer |
| Punk | Punk | MP | Serie hält länger | schnell, wenig Trefferpunkte |

Der Agent ist von Anfang an da, die anderen kosten Punkte. Die übrigen
City-Man-Varianten wären Skins.

### Drops

- **Wann:** nach jedem geschafften Raum, vor dem Ausgang. Zur Wahl stehen drei Dinge, eines nimmt man mit. Nach einem Boss gibt es eine bessere Auswahl.
- **Plätze:** zwei Waffen, drei Module. Ist alles voll, ersetzt der neue Fund einen alten.
- **Doppelt gefunden:** hebt die Stufe (Waffe: mehr Schaden; Modul: stärkerer Effekt), bis Stufe 3.
- **Vorrat:** Anfangs sind nur wenige Waffen und Module im Vorrat; weitere schaltet man im Shop frei.
- Alternative: Gegner lassen Dinge fallen, die man im Kampf aufhebt. Das ist lebendiger, aber unruhiger und schwerer auszubalancieren.

### Waffen (4 vorhanden, 6 neu)

| Waffe | Charakter |
|---|---|
| Pistole | einzelne Schüsse, mittlere Rate |
| Schrot | Fächer, kurze Reichweite |
| Schwerlaser | lädt auf, Strahl durch alle in einer Linie |
| Granate | landet am Fadenkreuz, Flächenschaden |
| **MP** | hohe Feuerrate, wenig Schaden, Streuung wächst im Dauerfeuer |
| **Präzisionsgewehr** | langsam, viel Schaden, keine Streuung; geduckt noch stärker |
| **Flammenwerfer** | kurzer Kegel, Dauerschaden; lässt Fässer und Minen hochgehen |
| **Kettenblitz** | springt vom Ziel auf bis zu drei Gegner in der Nähe über |
| **Impulskanone** | kaum Schaden, stößt Gegner weg wie ein kleiner Kick auf Distanz |
| **Sägeblatt** | prallt an Wänden ab und trifft auf dem Rückweg erneut |

### Module (6 vorhanden, 8 neu)

| Modul | Wirkung |
|---|---|
| Magnet, Nachbrenner, Schwerer Stiefel, Ruhige Hand, Panzerung, Taktgeber | wie bisher |
| **Doppelsprung** | zweiter Sprung in der Luft, mit Richtungswechsel |
| **Gleitschuhe** | Slide reicht weiter und macht Schaden |
| **Kettenreaktion** | Domino gibt den vollen Schwung weiter und macht mehr Schaden |
| **Sprengkick** | gekickte Gegner explodieren beim Aufprall |
| **Schildgenerator** | fängt einen Treffer pro Raum ab |
| **Adrenalin** | schneller, je höher die Serie |
| **Querschläger** | Schüsse prallen einmal von der Wand ab |
| **Schnellzieher** | ein Dash setzt die Abklingzeit der Waffe zurück |

### Entschieden **[fest]**

- Jeder Charakter hat eine feste Standardwaffe. Weitere Waffen verdient man im Run dazu; die Standardwaffe lässt sich im Run aufwerten.
- Bereits gekaufte Waffen und Module im Speicherstand werden verworfen.
- Zerstörte Gegenstände (Fässer, Geschütze und Ähnliches) haben eine eigene Drop-Liste. Sie können Heilung fallen lassen, später auch anderes.
- Der Rest des Entwurfs wird zunächst so umgesetzt, einschließlich der Auswahl aus drei Dingen nach jedem Raum.
- Gegner dürfen schneller sein und öfter angreifen.

Reihenfolge: Explosionen, dann Charaktere, dann Loot, dann der Rest. Nach jedem Schritt wird getestet.

Stand: Explosionen und Charaktere sind gebaut. Die vier Charaktere stehen im
Menü unter „Charakter"; Waffen, Module und Sets sind aus dem Shop entfernt, die
MP ist als fünfte Waffe dazugekommen.

Loot ist ebenfalls gebaut: Nach jedem geschafften Raum steht eine Auswahl aus
drei Dingen an (nach einem Boss bringt jedes zwei Stufen). Es gibt die
Standardwaffe plus einen Platz für eine gefundene Zweitwaffe und drei
Modul-Plätze; alles hat drei Stufen. Zerstörte Fässer, Minen und Geschütze
lassen mit 35, 15 und 60 % Heilung (+20 Trefferpunkte) fallen. Geschosse und
Strahl starten an der gezeichneten Waffe.

Auch der Rest ist gebaut: fünf weitere Waffen (Präzisionsgewehr,
Flammenwerfer, Kettenblitz, Impulskanone, Sägeblatt), acht weitere Module und
der Drop-Vorrat im Shop – die neuen Waffen und Module tauchen erst als Beute
auf, wenn man sie dort freigeschaltet hat. Gegner sind rund 25 % schneller,
Geschützdrohne, Boss und Geschütze greifen öfter an.

### Für später vorgemerkt (von dir genannt)

- Das Loot-System weiter ausarbeiten.
- Schild-Drohnen reflektieren Geschosse, statt sie nur zu schlucken.
- Eigene Explosionen können auch der Figur schaden.
- Minen eventuell als passive Fähigkeit.
- **Überlegung, noch Konzeptphase:** Ducken/Slide und Springen durch andere Mechaniken ersetzen, zum Beispiel Parry statt Ducken und eine Fähigkeit statt Sprung. Vorher müssen Boss-Fähigkeiten, Angriffs-Animationen der Gegner und Ähnliches überarbeitet werden. Betroffen wären die drei Höhen-Ebenen samt aller Gefahren mit Höhe sowie die Module Doppelsprung und Gleitschuhe.

### Für das spätere Balancing vorgemerkt

- Das Spiel ist derzeit viel zu einfach; ein Run reicht, um alles gekauft zu haben. Preise müssen überarbeitet werden.
- Räume ohne Kill-Aufgabe oder Zeitlimit lassen sich ausnutzen: Wer die Aufgabe nicht abschließt, kann endlos Punkte sammeln (×10 nur mit Dash war schnell erreicht). Die Aufgaben müssen überarbeitet werden.

## 10. Stil-Phase (als Nächstes)

Stand:
- **Figur [fest]:** City Man (Variante 3, Anzug) in Seitenansicht, gespiegelt nach Zielrichtung, mit getrennt drehbarer Waffe. Cyborg und andere können später als Skin oder eigene Figur in den Shop.
- **Notlösungen, bis es eigene Animationen gibt:** Kick = Schlag, Sprung und Dash = ein Renn-Bild, Ducken = gestauchtes Bild, Slide = das Hechten-Bild aus der Tod-Animation.
- **Ton [fest]:** per Code erzeugte Platzhalter, ein Schuss-Sound für alle Waffen. Eigene Dateien lassen sich über `public/sounds/sounds.json` eintragen. Dauertöne (Warnton der Sprengdrohne) laufen als Schleife, solange ihre Bedingung gilt; die Logik meldet sie über `alarmsOf` (`src/sim/enemies.ts`), `src/alarmLoop.ts` taktet sie, `src/audio.ts` spielt sie. Musik kommt später.
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
