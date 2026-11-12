// Gemeinsame Typen der Spiellogik. Die Logik läuft in festen Schritten von STEP
// Sekunden und kennt weder Canvas noch DOM – alle Zeiten sind Sekunden, alle
// Geschwindigkeiten px/s.

export const ARENA = 800;
export const STEP = 1 / 120;

/** Wodurch ein Gegner Schaden nimmt; bestimmt den Art-Multiplikator. */
export type Source = 'gun' | 'dash' | 'kick' | 'env';
/** Höhe einer Gefahr. */
export type Height = 'low' | 'high' | 'full';
/** Auf welcher Höhe sich die Figur gerade befindet. */
export type Level = 'low' | 'mid' | 'high';

export type WeaponId = 'pistol' | 'shotgun' | 'rail' | 'grenade';
export type ModuleId = 'magnet' | 'longdash' | 'heavyboot' | 'steady' | 'plating' | 'combo';
export type EnemyKind = 'hunter' | 'gunner' | 'shield' | 'bomber' | 'heavy' | 'boss';
export type ObjectiveType = 'collect' | 'clear' | 'survive' | 'destroy' | 'boss';

/** Was im Spiel gerade passiert ist – für Ton und Effekte. Die Logik sammelt, die Oberfläche spielt ab. */
export type GameEvent =
  | 'shoot' | 'charge' | 'beam' | 'dash' | 'kick' | 'jump' | 'slide'
  | 'hit' | 'kill' | 'hurt' | 'explode' | 'pickup' | 'roomClear' | 'die';

/** Werte der Figur für einen Run – ergeben sich aus Upgrades und gewähltem Set. */
export interface Stats {
  speed: number;
  pickup: number; // zusätzliche Aufheb-Reichweite
  maxHp: number;
  extraLives: number;
  dashCharges: number;
  dashIframes: number;
  dashRecharge: number;
  dashDamage: number;
  dashTime: number;
  kickForce: number;
  kickCooldown: number;
  impact: number; // Faktor auf Aufprallschaden
  damageTaken: number; // Faktor auf erlittenen Schaden
  stillSpread: number; // Faktor auf die Streuung im Stand
  streakTime: number; // Sekunden ohne Kill, bis die Serie verfällt
  weapons: WeaponId[]; // Haupt- und ggf. Zweitwaffe
  weaponDamage: Record<WeaponId, number>; // Schadensfaktor je Waffe
}

export interface Input {
  moveX: number;
  moveY: number;
  aimX: number; // Mausposition in Raum-Koordinaten
  aimY: number;
  fire: boolean; // gehalten
  duck: boolean; // gehalten
  dash: boolean; // in diesem Schritt gedrückt
  jump: boolean;
  kick: boolean;
  swap: boolean; // Waffe wechseln
}

export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mode: number; // Boss: zählt die Angriffe durch, um sie abzuwechseln
  pushX: number; // Rückstoß, klingt ab
  pushY: number;
  kicked: boolean; // fliegt gerade nach einem Kick oder Aufprall
  dead: boolean; // zerstört, fliegt aber als Wrack noch weiter
  suicide: boolean; // hat sich selbst gesprengt – gibt keine Punkte
  lastHit: Source;
  action: number; // Nummer der Aktion (Kick, Dash, Schuss), die ihn zuletzt erwischt hat; 0 = keine
  hitFlash: number;
  dashHit: boolean; // vom laufenden Dash schon getroffen
  laserCooldown: number;
  cooldown: number; // Zeit bis zum nächsten Angriff (Geschützdrohne)
  windup: number; // > 0: zielt gerade und feuert gleich
  fuse: number | null; // Sprengdrohne: Zeit bis zur Detonation
  angle: number; // Blickrichtung (Schild-Mech)
}

/** Geschoss der Figur. */
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  blast: number; // Explosionsradius, 0 = keiner
  action: number;
}

/**
 * Strahl des Schwerlasers: lädt erst auf (charge), dann steht er ein paar
 * Schritte lang (fire). Er geht von der Figur in Zielrichtung aus und folgt ihr.
 */
export interface PlayerBeam {
  charge: number; // verbleibende Ladezeit, > 0 = baut sich noch auf
  chargeTime: number; // gesamte Ladezeit, für die Darstellung
  fire: number; // verbleibende Brenndauer
  fireTime: number;
  width: number; // halbe Breite
  damage: number;
  action: number;
  length: number; // reicht bis zur Wand oder bis zum ersten Schild von vorn
  hit: (Enemy | Turret)[]; // schon getroffen – jeder höchstens einmal je Strahl
}

/** Geschoss eines Gegners oder Geschützes; fliegt auf Höhe "hoch". */
export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
}

export interface Laser {
  vertical: boolean;
  pos: number;
  speed: number; // 0 = Sperrlaser, sonst Wanderlaser
  height: Height;
  warn: number; // > 0 = noch angekündigt, macht keinen Schaden
  life: number;
}

/** Zielstrahl: verfolgt die Figur, rastet ein, feuert kurz. */
export interface Beam {
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  phase: 'track' | 'lock' | 'fire';
  t: number;
}

export interface Field {
  x: number;
  y: number;
  r: number;
  warn: number;
  active: number;
}

export interface Mine {
  x: number;
  y: number;
  fuse: number | null;
  action: number;
}

export interface Barrel {
  x: number;
  y: number;
  fuse: number | null;
  action: number;
}

export interface Turret {
  x: number;
  y: number;
  hp: number;
  cooldown: number;
  hitFlash: number;
  dashHit: boolean;
}

export interface RoomPlan {
  objective: ObjectiveType;
  goal: number;
  mix: [EnemyKind, number][]; // Gegnertypen mit Gewicht
  maxEnemies: number;
  spawnEvery: number;
  laserEvery: [number, number];
  maxLasers: number;
  beamEvery: number | null;
  fieldEvery: number | null;
  mines: number;
  barrels: number;
  turrets: number;
  multiplier: number; // Raum-Multiplikator auf alle Punkte
}

export interface Game {
  stats: Stats;

  // Raum
  room: number;
  plan: RoomPlan;
  phase: 'play' | 'exit' | 'transition';
  transition: number; // verstrichene Zeit des Raumwechsels
  exitFromX: number;
  exitFromY: number;
  progress: number; // Fortschritt der Aufgabe
  roomHit: boolean; // in diesem Raum schon getroffen worden

  // Figur
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  speedLimit: number; // aktuelles Tempolimit aus dem Blickwinkel, gibt nur langsam nach
  air: number; // verbleibende Flugzeit, > 0 = in der Luft
  ducking: boolean;
  sliding: boolean;
  aimX: number; // Zielrichtung, normiert
  aimY: number;
  hp: number;
  lives: number; // verbleibende Extra-Leben
  shield: number; // Schonzeit nach einem Treffer
  hitFlash: number;
  dashes: number; // verfügbare Dash-Ladungen
  dashRecharge: number;
  dashTime: number; // > 0 solange der Dash läuft
  dashing: boolean;
  dashX: number;
  dashY: number;
  invuln: number; // I-Frames
  kickCooldown: number;
  kickFlash: number;
  weapon: number; // Index in stats.weapons
  weaponCooldown: number[];

  // Welt
  bullets: Bullet[];
  playerBeam: PlayerBeam | null;
  enemies: Enemy[];
  spawns: { x: number; y: number; t: number; kind: EnemyKind }[];
  spawnTimer: number;
  lasers: Laser[];
  laserTimer: number;
  beams: Beam[];
  beamTimer: number;
  fields: Field[];
  fieldTimer: number;
  mines: Mine[];
  barrels: Barrel[];
  turrets: Turret[];
  shots: Shot[];
  blasts: { x: number; y: number; r: number; t: number }[];
  bananas: { x: number; y: number }[];

  // Punkte
  score: number;
  streak: number;
  streakTimer: number;
  actionId: number; // zählt Kicks, Dashs und Mehrfach-Schüsse durch
  comboAction: number; // Aktion, die zuletzt einen Kill gebracht hat
  comboKills: number;
  popups: { x: number; y: number; text: string; t: number }[];
  kills: number;
  roomKills: number;
  time: number;
  over: boolean;
  events: GameEvent[]; // seit dem letzten Abholen aufgelaufen
}
