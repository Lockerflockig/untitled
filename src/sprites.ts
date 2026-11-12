// Sprites für Gegner und Explosionen, dazu die gemeinsamen Helfer zum Laden.
// Die Spielfigur steht in playerSprite.ts. Alle Figuren sind in Seitenansicht
// gezeichnet und werden je nach Blickrichtung gespiegelt.

import type { BlastKind, Enemy, EnemyKind, Game } from './sim/types.ts';
import { ENEMIES } from './sim/core.ts';
import { BOMB_FUSE, BOSS_WINDUP, GUNNER_WINDUP } from './sim/enemies.ts';

type Ctx = CanvasRenderingContext2D;
interface Clip { file: string; frames: number; fps: number }

export function load(path: string) {
  const img = new Image();
  img.src = path;
  return img;
}
export const loaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

export function shadow(ctx: Ctx, x: number, y: number, width: number, shrink = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, width * (1 - 0.3 * shrink), width * 0.35 * (1 - 0.3 * shrink), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fill();
}

// --- Gegner -----------------------------------------------------------------

interface EnemySprite {
  size: number; // Kantenlänge eines Einzelbilds
  originX: number; // Spalte, in der die Figur mittig steht
  tall: number; // Höhe der Figur im Bild
  scale: number;
  hover: boolean; // schwebt leicht auf und ab
  idle: Clip;
  move: Clip;
  hurt: Clip;
  dead: Clip;
  attack?: Clip;
}

const ENEMY_SPRITES: Record<EnemyKind, EnemySprite> = {
  hunter: {
    size: 128, originX: 60, tall: 66, scale: 0.85, hover: true,
    idle: { file: 'Idle', frames: 5, fps: 8 },
    move: { file: 'Idle', frames: 5, fps: 12 }, // das Paket hat für ihn keine Lauf-Animation
    hurt: { file: 'Hurt', frames: 3, fps: 10 },
    dead: { file: 'Dead', frames: 4, fps: 8 },
  },
  gunner: {
    size: 128, originX: 63, tall: 72, scale: 0.85, hover: false,
    idle: { file: 'Idle', frames: 6, fps: 6 },
    move: { file: 'Walk', frames: 6, fps: 9 },
    hurt: { file: 'Hurt', frames: 4, fps: 10 },
    dead: { file: 'Dead', frames: 5, fps: 8 },
    attack: { file: 'Shot_1', frames: 11, fps: 20 },
  },
  shield: {
    size: 128, originX: 63, tall: 77, scale: 0.95, hover: false,
    idle: { file: 'Idle', frames: 5, fps: 6 },
    move: { file: 'Walk', frames: 8, fps: 9 },
    hurt: { file: 'Hurt', frames: 3, fps: 10 },
    dead: { file: 'Dead', frames: 7, fps: 8 },
  },
  bomber: {
    size: 96, originX: 24, tall: 41, scale: 1.2, hover: false,
    idle: { file: 'Idle', frames: 4, fps: 8 },
    move: { file: 'Walk', frames: 6, fps: 14 },
    hurt: { file: 'Hurt', frames: 2, fps: 10 },
    dead: { file: 'Death', frames: 6, fps: 8 },
  },
  heavy: {
    size: 96, originX: 37, tall: 64, scale: 1.3, hover: false,
    idle: { file: 'Idle', frames: 4, fps: 6 },
    move: { file: 'Walk', frames: 6, fps: 7 },
    hurt: { file: 'Hurt', frames: 2, fps: 10 },
    dead: { file: 'Death', frames: 6, fps: 8 },
  },
  boss: {
    size: 96, originX: 46, tall: 65, scale: 1.7, hover: false,
    idle: { file: 'Idle', frames: 6, fps: 6 },
    move: { file: 'Drive', frames: 6, fps: 10 },
    hurt: { file: 'Hurt', frames: 2, fps: 10 },
    dead: { file: 'Death', frames: 4, fps: 8 },
  },
};

const enemyImages = new Map<string, HTMLImageElement>();
for (const [kind, s] of Object.entries(ENEMY_SPRITES)) {
  for (const clip of [s.idle, s.move, s.hurt, s.dead, s.attack]) {
    if (clip) enemyImages.set(`${kind}/${clip.file}`, load(`assets/enemies/${kind}/${clip.file}.png`));
  }
}
const enemyImage = (kind: EnemyKind, clip: Clip) => enemyImages.get(`${kind}/${clip.file}`)!;

export const enemySpriteReady = (kind: EnemyKind) => {
  const s = ENEMY_SPRITES[kind];
  return [s.idle, s.move, s.hurt, s.dead, s.attack].every((c) => !c || loaded(enemyImage(kind, c)));
};

export function drawEnemySprite(ctx: Ctx, g: Game, e: Enemy, time: number) {
  const def = ENEMIES[e.kind];
  const s = ENEMY_SPRITES[e.kind];
  const feetY = e.y + def.r * 0.6;
  const top = feetY - s.tall * s.scale;
  const flying = e.kicked || e.dead;
  const fusing = e.fuse !== null && !e.dead;
  // Schaut zur Figur; die Schilddrohne dorthin, wohin ihr Schild zeigt
  const facing = e.kind === 'shield' ? (Math.cos(e.angle) >= 0 ? 1 : -1) : g.x >= e.x ? 1 : -1;

  let clip = s.idle;
  let frame = -1;
  if (e.dead) {
    clip = s.dead;
    frame = 1;
  } else if (e.kind === 'boss' && e.windup > 0) {
    clip = s.idle; // steht still und kündigt den Angriff an
  } else if (flying || (e.hitFlash > 0 && e.kind !== 'boss')) {
    clip = s.hurt;
    frame = Math.min(s.hurt.frames - 1, 1);
  } else if (s.attack && e.windup > 0) {
    clip = s.attack;
    frame = Math.min(s.attack.frames - 1, Math.floor((1 - e.windup / GUNNER_WINDUP) * s.attack.frames));
  } else if (!fusing) {
    clip = s.move;
  }
  if (frame < 0) frame = Math.floor(time * clip.fps + e.x * 0.05) % clip.frames;

  if (fusing) {
    // Sprengradius der Sprengdrohne
    ctx.beginPath();
    ctx.arc(e.x, e.y, 80 * (1 - (e.fuse ?? 0) / BOMB_FUSE), 0, Math.PI * 2);
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  shadow(ctx, e.x, feetY, def.r * 0.95);

  ctx.save();
  // Wracks verblassen mit dem Schwung; die Lunte lässt die Sprengdrohne blinken
  if (e.dead) ctx.globalAlpha = Math.min(1, Math.hypot(e.pushX, e.pushY) / 400);
  else if (fusing && Math.floor(time * 16) % 2) ctx.globalAlpha = 0.45;
  const bob = s.hover && !flying ? Math.sin(time * 5 + e.x) * 3 - 4 : 0;
  ctx.translate(e.x, feetY + bob);
  if (flying) {
    // Im Flug überschlägt sich der Gegner um seine Körpermitte
    const half = (s.tall * s.scale) / 2;
    ctx.translate(0, -half);
    ctx.rotate(time * 14 * Math.sign(e.pushX || 1));
    ctx.translate(0, half);
  }
  ctx.scale(facing * s.scale, s.scale);
  ctx.drawImage(enemyImage(e.kind, clip), frame * s.size, 0, s.size, s.size, -s.originX, -s.size + 1, s.size, s.size);
  ctx.restore();
  if (e.dead) return;

  if (e.kind === 'gunner' && e.windup > 0) {
    // zielt: Ring zieht sich zusammen, dann fällt der Schuss
    ctx.beginPath();
    ctx.arc(e.x, e.y, def.r + 14 * (e.windup / GUNNER_WINDUP), 0, Math.PI * 2);
    ctx.strokeStyle = '#4da3ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (e.kind === 'boss' && e.windup > 0) {
    // Ankündigung: Farbe verrät den Angriff – blau = hohe Geschosse, orange = Bodenfelder
    ctx.beginPath();
    ctx.arc(e.x, e.y, def.r + 30 * (e.windup / BOSS_WINDUP), 0, Math.PI * 2);
    ctx.strokeStyle = e.mode % 2 === 0 ? '#4da3ff' : '#ffb347';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (e.kind === 'shield' && !e.kicked) {
    // Schild: blockt Schüsse von vorn
    ctx.beginPath();
    ctx.arc(e.x, e.y, def.r + 9, e.angle - 1.2, e.angle + 1.2);
    ctx.strokeStyle = 'rgba(230, 220, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  if (e.hp < e.maxHp || e.kind === 'boss') {
    const w = Math.max(28, def.r * 2);
    const h = e.kind === 'boss' ? 7 : 4;
    ctx.fillStyle = '#3a1820';
    ctx.fillRect(e.x - w / 2, top - 10 - h, w, h);
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(e.x - w / 2, top - 10 - h, w * Math.max(0, e.hp / e.maxHp), h);
  }
}

// --- Explosion --------------------------------------------------------------

// Jede Art von Explosion kann ein eigenes Bild haben: assets/fx/explosion-<art>.png,
// ein Streifen quadratischer Einzelbilder nebeneinander (die Anzahl ergibt sich aus
// Breite ÷ Höhe). Fehlt es, wird das gemeinsame explosion.png umgefärbt und
// anders skaliert, damit man die Arten trotzdem auseinanderhält.

interface BlastLook {
  filter: string; // Umfärbung für das gemeinsame Bild (CSS-Filter)
  scale: number; // Bildgröße im Verhältnis zum Wirkradius
  foot: number; // wo im Bild der Zündpunkt sitzt (Anteil der Höhe von oben)
  own?: { scale: number; foot: number }; // dieselben Werte für das eigene Bild, falls es anders geschnitten ist
}

// Eigene Bilder gibt es derzeit für Mine (flacher Ausbruch am Boden),
// Sprengdrohne (runde Druckwelle), Geschütz (Zackenblitz) und Wrack
// (Stichflamme, die sich einrollt). Granate, Fass und Schilddrohne nutzen die
// Feuerwolke; die Schilddrohne ist blau umgefärbt.
export const BLAST_LOOKS: Record<BlastKind, BlastLook> = {
  grenade: { filter: 'none', scale: 2.6, foot: 0.78 },
  barrel: { filter: 'hue-rotate(-25deg) saturate(1.6) brightness(0.9)', scale: 3.1, foot: 0.8 },
  mine: { filter: 'hue-rotate(160deg) saturate(1.4) brightness(1.2)', scale: 2.4, foot: 0.7, own: { scale: 2.6, foot: 0.5 } },
  bomb: { filter: 'hue-rotate(250deg) saturate(1.5)', scale: 2.8, foot: 0.75, own: { scale: 2.4, foot: 0.5 } },
  shield: { filter: 'hue-rotate(200deg) saturate(1.2) brightness(1.2)', scale: 2.6, foot: 0.75 },
  turret: { filter: 'saturate(0.2) brightness(1.5)', scale: 2.2, foot: 0.7, own: { scale: 3, foot: 0.5 } },
  wreck: { filter: 'grayscale(0.7) brightness(0.85)', scale: 2.4, foot: 0.78, own: { scale: 3.2, foot: 0.9 } },
  revive: { filter: 'hue-rotate(120deg) saturate(1.3) brightness(1.3)', scale: 1.6, foot: 0.6 },
};

const EXPLOSION = load('assets/fx/explosion.png');
const BLAST_KINDS = Object.keys(BLAST_LOOKS) as BlastKind[];
const explosionByKind = Object.fromEntries(
  BLAST_KINDS.map((kind) => [kind, load(`assets/fx/explosion-${kind}.png`)]),
) as Record<BlastKind, HTMLImageElement>;

/**
 * Zeichnet das Bild einer Explosion mit Radius r zum Fortschritt p (0..1).
 * Gibt false zurück, solange kein Bild geladen ist.
 */
export function drawExplosionSprite(ctx: Ctx, kind: BlastKind, x: number, y: number, r: number, p: number) {
  const own = explosionByKind[kind];
  const img = loaded(own) ? own : EXPLOSION;
  if (!loaded(img)) return false;
  const base = BLAST_LOOKS[kind];
  const look = img === own && base.own ? { ...base, ...base.own } : base;
  const size = img.naturalHeight;
  const frames = Math.max(1, Math.floor(img.naturalWidth / size));
  const frame = Math.min(frames - 1, Math.floor(p * frames));
  const drawn = r * look.scale;
  ctx.save();
  if (img === EXPLOSION) ctx.filter = look.filter;
  // Der Fuß der Explosion steht auf dem Zündpunkt
  ctx.drawImage(img, frame * size, 0, size, size, x - drawn / 2, y - drawn * look.foot, drawn, drawn);
  ctx.restore();
  return true;
}
