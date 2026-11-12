// Die Spielfigur als Sprite. Jeder Charakter hat eigene Bilder; alle sind in
// Seitenansicht gezeichnet und werden je nach Zielrichtung gespiegelt.
//
// Zwei Arten, die Waffe zu halten:
//  - Agent (City Man): Das Paket hat nur Stehen, Gehen, Rennen, Schlag, Treffer
//    und Tod. Die Waffe sitzt in der Hand der jeweiligen Animation. Notlösungen:
//    Kick = Schlag, Sprung und Dash = ein Renn-Bild, Ducken = gestauchtes Bild,
//    Slide = das Hechten-Bild aus der Tod-Animation.
//  - Cyborg, Biker, Punk: Körper ohne Arme plus ein eigener Arm, der sich von der
//    Schulter aus zur Maus dreht. Dazu echte Bilder für Ducken, Sprung und Kick.

import type { CharacterId, Game, WeaponId } from './sim/types.ts';
import { jumpHeight } from './sim/core.ts';
import { load, loaded, shadow } from './sprites.ts';

type Ctx = CanvasRenderingContext2D;
interface Clip { file: string; frames: number; fps: number }
type ClipName = 'idle' | 'walk' | 'run' | 'kick' | 'hurt' | 'dead' | 'jump' | 'duck';
type Pose = [ClipName, number]; // Animation und festes Einzelbild

interface CharSprite {
  dir: string;
  size: number; // Kantenlänge eines Einzelbilds
  originX: number; // Spalte, in der die Figur mittig steht
  scale: number;
  clips: Partial<Record<ClipName, Clip>>;
  dash: Pose;
  slide: Pose;
  duck: Pose | null; // null = Steh-Bild stauchen
  jump: ClipName | Pose; // ganze Animation über die Flugzeit oder ein festes Bild
  // Waffe an der Hand der Animation: Position je Einzelbild (Pixel im Bild)
  hands?: Partial<Record<ClipName, [number, number][]>>;
  slideHand?: [number, number];
  // oder: eigener Arm, der sich um die Schulter dreht
  arm?: {
    pivot: [number, number]; // Schulter im Arm-Bild
    reach: number; // Abstand Schulter–Hand im Arm-Bild
    shoulder: [number, number]; // Schulter im Körper-Bild
    duckShoulder: [number, number];
    slideShoulder: [number, number];
  };
  gunScale: number;
}

const FEET = 12; // die Füße stehen so weit unter dem Mittelpunkt des Trefferkreises
const JUMP_LIFT = 34;
const KICK_ANIM_TIME = 0.28;
const GRIP_X = 0.2; // Lage des Griffs im Waffenbild, als Anteil von Breite und Höhe
const GRIP_Y = 0.7;
const MUZZLE_Y = 0.35; // Höhe des Laufs im Waffenbild, als Anteil von oben

const AGENT: CharSprite = {
  dir: 'assets/player', size: 128, originX: 60, scale: 1,
  clips: {
    idle: { file: 'Idle', frames: 6, fps: 6 },
    walk: { file: 'Walk', frames: 10, fps: 12 },
    run: { file: 'Run', frames: 10, fps: 14 },
    kick: { file: 'Attack', frames: 4, fps: 14 },
    hurt: { file: 'Hurt', frames: 3, fps: 12 },
    dead: { file: 'Dead', frames: 5, fps: 8 },
  },
  dash: ['run', 2], slide: ['dead', 3], duck: null, jump: ['run', 2],
  // aus den hautfarbenen Pixeln der Sprites ausgemessen; beim Rennen jeweils die vordere Hand
  hands: {
    idle: [[56, 100], [56, 100], [56, 100], [56, 99], [56, 99], [56, 100]],
    walk: [[57, 97], [57, 98], [61, 98], [63, 97], [65, 95], [65, 97], [63, 98], [61, 100], [60, 99], [59, 97]],
    run: [[85, 82], [83, 77], [83, 76], [84, 83], [72, 92], [86, 81], [84, 75], [84, 75], [85, 83], [72, 93]],
    hurt: [[60, 81], [59, 82], [58, 83]],
  },
  slideHand: [78, 112],
  gunScale: 1.8,
};

/** Cyborg, Biker und Punk stammen aus demselben Paket und sind gleich aufgebaut. */
const cyberpunk = (id: string): CharSprite => ({
  dir: `assets/chars/${id}`, size: 48, originX: 14, scale: 1.9,
  clips: {
    idle: { file: 'Idle', frames: 4, fps: 6 },
    walk: { file: 'Walk', frames: 6, fps: 10 },
    run: { file: 'Run', frames: 6, fps: 12 },
    kick: { file: 'Punch', frames: 6, fps: 20 },
    hurt: { file: 'Hurt', frames: 2, fps: 10 },
    dead: { file: 'Death', frames: 6, fps: 8 },
    jump: { file: 'Jump', frames: 4, fps: 8 },
    duck: { file: 'Sitdown', frames: 4, fps: 8 },
  },
  dash: ['run', 2], slide: ['dead', 3], duck: ['duck', 2], jump: 'jump',
  arm: { pivot: [14, 15], reach: 12, shoulder: [14, 23], duckShoulder: [15, 29], slideShoulder: [18, 40] },
  gunScale: 1,
});

const SPRITES: Record<CharacterId, CharSprite> = {
  agent: AGENT,
  cyborg: cyberpunk('cyborg'),
  biker: cyberpunk('biker'),
  punk: cyberpunk('punk'),
};

const images = new Map<string, HTMLImageElement>();
for (const s of Object.values(SPRITES)) {
  for (const clip of Object.values(s.clips)) images.set(`${s.dir}/${clip.file}`, load(`${s.dir}/${clip.file}.png`));
  if (s.arm) images.set(`${s.dir}/Arm`, load(`${s.dir}/Arm.png`));
}
const image = (s: CharSprite, file: string) => images.get(`${s.dir}/${file}`)!;

const guns: Record<WeaponId, HTMLImageElement> = {
  pistol: load('assets/guns/pistol.png'),
  smg: load('assets/guns/smg.png'),
  shotgun: load('assets/guns/shotgun.png'),
  rail: load('assets/guns/rail.png'),
  grenade: load('assets/guns/grenade.png'),
  sniper: load('assets/guns/sniper.png'),
  flamer: load('assets/guns/flamer.png'),
  chain: load('assets/guns/chain.png'),
  pulse: load('assets/guns/pulse.png'),
  saw: load('assets/guns/saw.png'),
};

/** Erst wenn alle Bilder des Charakters da sind, wird er als Sprite gezeichnet. */
export function spritesReady(character: CharacterId) {
  const s = SPRITES[character];
  return Object.values(s.clips).every((c) => loaded(image(s, c.file))) && (!s.arm || loaded(image(s, 'Arm')));
}

interface Pose2 {
  s: CharSprite;
  name: ClipName;
  frame: number;
  squash: number;
  facing: number;
  height: number;
  feetY: number;
  kicking: boolean;
}

/** Zustand der Figur → Animation, Einzelbild und Haltung. */
function poseOf(g: Game, groundY: number, time: number): Pose2 {
  const s = SPRITES[g.stats.character];
  const speed = Math.hypot(g.vx, g.vy);
  // Blick folgt der Maus; im Slide zeigt die Figur in Rutschrichtung
  const facing = g.sliding && Math.abs(g.vx) > 10 ? Math.sign(g.vx) : g.aimX >= 0 ? 1 : -1;

  let name: ClipName = 'idle';
  let frame = -1; // -1 = Schleife
  let squash = 1;
  const fixed = (pose: Pose) => {
    [name, frame] = pose;
  };
  const progress = (clip: ClipName, p: number) => {
    name = clip;
    frame = Math.min(s.clips[clip]!.frames - 1, Math.floor(p * s.clips[clip]!.frames));
  };
  const kickElapsed = g.stats.kickCooldown - g.kickCooldown;
  const kicking = g.kickCooldown > 0 && kickElapsed < KICK_ANIM_TIME;
  if (g.over) {
    fixed(['dead', s.clips.dead!.frames - 1]);
  } else if (kicking) {
    progress('kick', kickElapsed / KICK_ANIM_TIME);
  } else if (g.hitFlash > 0) {
    progress('hurt', 1 - g.hitFlash / 0.25);
  } else if (g.dashing) {
    fixed(s.dash);
  } else if (g.air > 0) {
    if (typeof s.jump === 'string') progress(s.jump, 1 - g.air / 0.45);
    else fixed(s.jump);
  } else if (g.sliding) {
    fixed(s.slide);
  } else if (g.ducking) {
    if (s.duck) fixed(s.duck);
    else squash = 0.68;
  } else if (speed > 180) {
    name = 'run';
  } else if (speed > 15) {
    name = 'walk';
  }
  if (frame < 0) {
    const clip = s.clips[name]!;
    frame = Math.floor(time * clip.fps) % clip.frames;
    // Läuft die Figur entgegen der Blickrichtung, spielt die Animation rückwärts
    if (g.vx * facing < -15) frame = clip.frames - 1 - frame;
  }
  return { s, name, frame, squash, facing, height: jumpHeight(g), feetY: groundY + FEET, kicking };
}

interface GunMount {
  x: number; // Drehpunkt im Raum: Schulter bzw. Hand
  y: number;
  angle: number;
  flip: number; // -1, wenn nach links gezielt wird – sonst stünde die Waffe auf dem Kopf
  scale: number;
  gunX: number; // linke obere Ecke des Waffenbilds, vom Drehpunkt aus
  gunY: number;
  gw: number;
  gh: number;
  gun: HTMLImageElement;
}

/** Wo die Waffe sitzt. null, wenn gerade keine gezeichnet wird (Kick, am Boden, Bild fehlt). */
function gunMount(g: Game, p: Pose2, x: number): GunMount | null {
  const { s } = p;
  const gun = guns[g.stats.weapons[g.weapon]];
  if (g.over || p.kicking || !loaded(gun)) return null;
  // Punkt im Körper-Bild → Position im Raum
  const place = ([px, py]: [number, number]): [number, number] => [
    x + p.facing * (px - s.originX) * s.scale,
    p.feetY - p.height * JUMP_LIFT - (s.size - 1 - py) * s.scale * p.squash,
  ];
  const gw = gun.width * s.gunScale;
  const gh = gun.height * s.gunScale;
  const base = { angle: Math.atan2(g.aimY, g.aimX), flip: g.aimX < 0 ? -1 : 1, gw, gh, gun };
  if (s.arm) {
    // Der Arm dreht sich um die Schulter zur Maus; die Waffe liegt in der Hand
    const shoulder = g.sliding ? s.arm.slideShoulder : g.ducking ? s.arm.duckShoulder : s.arm.shoulder;
    const [mx, my] = place(shoulder);
    return { ...base, x: mx, y: my, scale: s.scale, gunX: s.arm.reach - gw * GRIP_X, gunY: -gh * GRIP_Y };
  }
  // Die Waffe sitzt in der Hand der Animation und macht deren Bewegung mit
  const hand = g.sliding ? s.slideHand : s.hands?.[p.name]?.[p.frame];
  if (!hand) return null;
  const [mx, my] = place(hand);
  return { ...base, x: mx, y: my, scale: 1, gunX: -gw * GRIP_X, gunY: -gh * GRIP_Y };
}

/**
 * Mündung der gezeichneten Waffe im Raum – von hier starten Geschosse und Strahl.
 * null, wenn gerade keine Waffe zu sehen ist.
 */
export function muzzlePoint(g: Game, x: number, groundY: number, time: number): [number, number] | null {
  if (!spritesReady(g.stats.character)) return null;
  const m = gunMount(g, poseOf(g, groundY, time), x);
  if (!m) return null;
  // Der Lauf endet rechts im Waffenbild, etwa auf einem Drittel der Höhe
  const tx = (m.gunX + m.gw) * m.scale;
  const ty = (m.gunY + m.gh * MUZZLE_Y) * m.scale * m.flip;
  return [m.x + tx * Math.cos(m.angle) - ty * Math.sin(m.angle), m.y + tx * Math.sin(m.angle) + ty * Math.cos(m.angle)];
}

export function drawPlayerSprite(ctx: Ctx, g: Game, x: number, groundY: number, time: number) {
  const p = poseOf(g, groundY, time);
  const { s } = p;
  const clip = s.clips[p.name]!;

  shadow(ctx, x, p.feetY, 17, p.height);

  const body = (px: number, py: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py - p.height * JUMP_LIFT);
    ctx.scale(p.facing * s.scale, p.squash * s.scale);
    ctx.drawImage(image(s, clip.file), p.frame * s.size, 0, s.size, s.size, -s.originX, -s.size + 1, s.size, s.size);
    ctx.restore();
  };

  if (g.dashing) {
    for (let i = 3; i >= 1; i--) body(x - g.dashX * i * 26, p.feetY - g.dashY * i * 26, 0.28 - i * 0.07);
  }
  let alpha = 1;
  if (g.shield > 0) alpha = Math.floor(time * 12) % 2 ? 0.35 : 0.9;
  else if (g.invuln > 0) alpha = 0.6;
  body(x, p.feetY, alpha);

  const m = gunMount(g, p, x);
  if (!m) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(m.x, m.y);
  ctx.rotate(m.angle);
  ctx.scale(m.scale, m.scale * m.flip);
  if (s.arm) ctx.drawImage(image(s, 'Arm'), -s.arm.pivot[0], -s.arm.pivot[1]);
  ctx.drawImage(m.gun, m.gunX, m.gunY, m.gw, m.gh);
  ctx.restore();
}
