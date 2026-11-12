// Gefahren: Laser, Zielstrahl, Bodenfeld, Mine, Fass, Geschütz und gegnerische Geschosse.
//
// Regel für Gegner: Gegen Laser und Zielstrahl sind sie immun, außer sie werden
// hineingekickt. Explosionen und Bodenfelder treffen sie immer.

import { ARENA, STEP } from './types.ts';
import type { Game } from './types.ts';
import {
  BLAST_TIME, ENEMIES, PLAYER_R, TURRET_R, award, damageEnemy, explode, heightHits, hurtPlayer, levelOf, rand,
} from './core.ts';
import { dropFrom } from './loot.ts';

// Laser
export const LASER_WARN = 1.0; // so lange kündigt sich ein Laser an
const LASER_STAY = 3; // Dauer eines Sperrlasers
const LASER_SWEEP = 200; // Tempo eines Wanderlasers
const LASER_MOVING_SHARE = 0.25; // Anteil der Wanderlaser: statisch zu beweglich wie 3 : 1
const LASER_DAMAGE = 25;
const LASER_ENEMY_DAMAGE = 40;

// Zielstrahl (hoch)
export const BEAM_TRACK = 1.2; // verfolgt die Figur
export const BEAM_LOCK = 0.5; // steht fest, feuert gleich
export const BEAM_FIRE = 0.25;
const BEAM_WIDTH = 6;
const BEAM_DAMAGE = 30;

// Bodenfeld (niedrig)
export const FIELD_WARN = 1.0;
export const FIELD_ACTIVE = 0.35;
export const FIELD_RADIUS = 70;
export const FIELD_DAMAGE = 20; // an der Figur; Felder des Bosses skalieren mit seinem Level, die aus dem Raum nicht
export const FIELD_ENEMY_DAMAGE = 30; // an Gegnern

// Mine (niedrig)
const MINE_TRIGGER = 45;
export const MINE_FUSE = 0.5;
const MINE_RADIUS = 85;
const MINE_DAMAGE = 30;
const MINE_ENEMY_DAMAGE = 60;

// Fass (voll)
const BARREL_RADIUS = 100;
const BARREL_DAMAGE = 35;
const BARREL_ENEMY_DAMAGE = 80;

// Geschütz (schießt hoch)
export const TURRET_HP = 60;
const TURRET_COOLDOWN = 1.5;
const TURRET_SHOT_SPEED = 300;
const TURRET_SHOT_DAMAGE = 15;
const TURRET_POINTS = 150;

export const SHOT_R = 5;

/**
 * Neuer Laser. Es gibt nur noch Laser der Höhe „voll": Springen und Ducken helfen nicht,
 * nur der Dash (I-Frames) schützt. Zwei Arten: Sperrlaser (steht für seine Dauer an einer
 * Stelle) und Wanderlaser (fährt von Wand zu Wand), im Verhältnis 3 : 1.
 */
export function spawnLaser(g: Game) {
  const vertical = Math.random() < 0.5;
  if (Math.random() < LASER_MOVING_SHARE) {
    const fromStart = Math.random() < 0.5;
    g.lasers.push({
      vertical,
      pos: fromStart ? 0 : ARENA,
      speed: fromStart ? LASER_SWEEP : -LASER_SWEEP,
      height: 'full',
      warn: LASER_WARN,
      life: Infinity,
    });
  } else {
    g.lasers.push({
      vertical,
      pos: rand(80, ARENA - 80),
      speed: 0,
      height: 'full',
      warn: LASER_WARN,
      life: LASER_STAY,
    });
  }
}

/** Zielstrahl von einem zufälligen Punkt an der Wand. */
function spawnBeam(g: Game) {
  const along = rand(60, ARENA - 60);
  const [ox, oy] = [[along, 0], [along, ARENA], [0, along], [ARENA, along]][Math.floor(Math.random() * 4)];
  const dist = Math.hypot(g.x - ox, g.y - oy) || 1;
  g.beams.push({ ox, oy, dx: (g.x - ox) / dist, dy: (g.y - oy) / dist, phase: 'track', t: BEAM_TRACK });
}

/** Abstand eines Punkts von einem Strahl; Infinity, wenn er hinter dem Ursprung liegt. */
function distanceToBeam(b: { ox: number; oy: number; dx: number; dy: number }, x: number, y: number) {
  const along = (x - b.ox) * b.dx + (y - b.oy) * b.dy;
  if (along < 0) return Infinity;
  return Math.abs((x - b.ox) * b.dy - (y - b.oy) * b.dx);
}

export function stepHazards(g: Game) {
  const level = levelOf(g);

  // --- Laser ---
  g.laserTimer -= STEP;
  if (g.laserTimer <= 0 && g.lasers.length < g.plan.maxLasers) {
    g.laserTimer = rand(g.plan.laserEvery[0], g.plan.laserEvery[1]);
    spawnLaser(g);
  }
  g.lasers = g.lasers.filter((l) => {
    if (l.warn > 0) {
      l.warn -= STEP;
      return true;
    }
    l.pos += l.speed * STEP;
    l.life -= STEP;
    return l.life > 0 && l.pos >= -5 && l.pos <= ARENA + 5;
  });
  for (const l of g.lasers) {
    if (l.warn > 0) continue;
    if (Math.abs((l.vertical ? g.x : g.y) - l.pos) < PLAYER_R && heightHits(l.height, level)) hurtPlayer(g, LASER_DAMAGE);
    for (const e of g.enemies) {
      if (e.kicked && !e.dead && e.laserCooldown <= 0 && Math.abs((l.vertical ? e.x : e.y) - l.pos) < ENEMIES[e.kind].r) {
        e.laserCooldown = 0.5;
        damageEnemy(e, LASER_ENEMY_DAMAGE, 'env');
      }
    }
  }

  // --- Zielstrahl ---
  if (g.plan.beamEvery !== null) {
    g.beamTimer -= STEP;
    if (g.beamTimer <= 0 && g.beams.length === 0) {
      g.beamTimer = g.plan.beamEvery;
      spawnBeam(g);
    }
  }
  g.beams = g.beams.filter((b) => {
    b.t -= STEP;
    if (b.phase === 'track') {
      const dist = Math.hypot(g.x - b.ox, g.y - b.oy) || 1;
      b.dx = (g.x - b.ox) / dist;
      b.dy = (g.y - b.oy) / dist;
      if (b.t <= 0) {
        b.phase = 'lock';
        b.t = BEAM_LOCK;
      }
    } else if (b.phase === 'lock') {
      if (b.t <= 0) {
        b.phase = 'fire';
        b.t = BEAM_FIRE;
      }
    } else {
      if (distanceToBeam(b, g.x, g.y) < PLAYER_R + BEAM_WIDTH && heightHits('high', level)) hurtPlayer(g, BEAM_DAMAGE);
      for (const e of g.enemies) {
        if (e.kicked && !e.dead && e.laserCooldown <= 0 && distanceToBeam(b, e.x, e.y) < ENEMIES[e.kind].r + BEAM_WIDTH) {
          e.laserCooldown = 0.5;
          damageEnemy(e, LASER_ENEMY_DAMAGE, 'env');
        }
      }
      return b.t > 0;
    }
    return true;
  });

  // --- Bodenfeld ---
  if (g.plan.fieldEvery !== null) {
    g.fieldTimer -= STEP;
    if (g.fieldTimer <= 0) {
      g.fieldTimer = g.plan.fieldEvery;
      g.fields.push({
        x: Math.min(ARENA - FIELD_RADIUS, Math.max(FIELD_RADIUS, g.x + rand(-120, 120))),
        y: Math.min(ARENA - FIELD_RADIUS, Math.max(FIELD_RADIUS, g.y + rand(-120, 120))),
        r: FIELD_RADIUS,
        warn: FIELD_WARN,
        active: FIELD_ACTIVE,
      });
    }
  }
  g.fields = g.fields.filter((f) => {
    if (f.warn > 0) {
      f.warn -= STEP;
      if (f.warn <= 0) {
        // Gegner trifft es einmal beim Auslösen
        for (const e of g.enemies) {
          if (Math.hypot(e.x - f.x, e.y - f.y) < f.r) damageEnemy(e, f.enemyDamage ?? FIELD_ENEMY_DAMAGE, 'env');
        }
      }
      return true;
    }
    f.active -= STEP;
    if (Math.hypot(g.x - f.x, g.y - f.y) < f.r && heightHits('low', level)) hurtPlayer(g, f.damage ?? FIELD_DAMAGE);
    return f.active > 0;
  });

  // --- Minen ---
  g.mines = g.mines.filter((m) => {
    if (m.fuse === null) {
      // Überspringen löst sie nicht aus
      const player = level !== 'high' && Math.hypot(g.x - m.x, g.y - m.y) < MINE_TRIGGER;
      const enemy = g.enemies.find((e) => !e.dead && Math.hypot(e.x - m.x, e.y - m.y) < MINE_TRIGGER - 15 + ENEMIES[e.kind].r);
      if (player || enemy) {
        m.fuse = MINE_FUSE;
        m.action = enemy?.kicked ? enemy.action : 0;
      }
      return true;
    }
    m.fuse -= STEP;
    if (m.fuse > 0) return true;
    explode(g, m.x, m.y, MINE_RADIUS, MINE_ENEMY_DAMAGE, level === 'high' ? 0 : MINE_DAMAGE, 'env', m.action, 'mine');
    dropFrom(g, 'mine', m.x, m.y);
    return false;
  });

  // --- Fässer ---
  g.barrels = g.barrels.filter((b) => {
    if (b.fuse === null) return true;
    b.fuse -= STEP;
    if (b.fuse > 0) return true;
    explode(g, b.x, b.y, BARREL_RADIUS, BARREL_ENEMY_DAMAGE, BARREL_DAMAGE, 'env', b.action, 'barrel');
    dropFrom(g, 'barrel', b.x, b.y);
    return false;
  });

  // --- Geschütze ---
  g.turrets = g.turrets.filter((t) => {
    t.hitFlash = Math.max(0, t.hitFlash - STEP);
    const dx = g.x - t.x;
    const dy = g.y - t.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (g.dashing && !t.dashHit && dist < PLAYER_R + TURRET_R + 6) {
      t.dashHit = true;
      t.hp -= g.stats.dashDamage;
      t.hitFlash = 0.12;
    }
    if (t.hp <= 0) {
      award(g, TURRET_POINTS, 1, t.x, t.y);
      if (g.plan.objective === 'destroy') g.progress++;
      g.blasts.push({ x: t.x, y: t.y, r: 40, t: BLAST_TIME, kind: 'turret' });
      dropFrom(g, 'turret', t.x, t.y);
      return false;
    }
    t.cooldown -= STEP;
    if (t.cooldown <= 0) {
      t.cooldown = TURRET_COOLDOWN;
      g.shots.push({
        x: t.x + (dx / dist) * TURRET_R, y: t.y + (dy / dist) * TURRET_R,
        vx: (dx / dist) * TURRET_SHOT_SPEED, vy: (dy / dist) * TURRET_SHOT_SPEED,
        damage: TURRET_SHOT_DAMAGE,
      });
    }
    return true;
  });

  // --- Gegnerische Geschosse (hoch) ---
  g.shots = g.shots.filter((s) => {
    s.x += s.vx * STEP;
    s.y += s.vy * STEP;
    if (s.x < 0 || s.x > ARENA || s.y < 0 || s.y > ARENA) return false;
    if (Math.hypot(g.x - s.x, g.y - s.y) < PLAYER_R + SHOT_R && heightHits('high', level)) {
      // I-Frames lassen das Geschoss durchfliegen, ein Treffer verbraucht es
      return !hurtPlayer(g, s.damage);
    }
    return true;
  });
}
