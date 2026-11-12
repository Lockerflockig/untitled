// Gemeinsame Bausteine der Spiellogik: Gegner-Werte, Schaden, Punkte, Explosionen.

import { ARENA } from './types.ts';
import type { BlastKind, Enemy, EnemyKind, Game, Height, Level, Source } from './types.ts';

export const PLAYER_R = 18;
export const JUMP_TIME = 0.45; // Flugdauer; Richtung in der Luft nicht änderbar
export const BANANA_R = 14;
export const MINE_R = 12;
export const BARREL_R = 16;
export const TURRET_R = 16;
const SHIELD_TIME = 0.6; // Schonzeit nach einem Treffer

/**
 * Grundwerte eines Gegnertyps in Level 1. Leben, Tempo und Schaden wachsen mit dem
 * Level (siehe enemyStats); Radius, Masse und Punkte bleiben immer gleich.
 */
export interface EnemyDef {
  name: string;
  r: number;
  hp: number;
  speed: number; // px/s
  speedMax: number; // px/s – harte Obergrenze, egal wie hoch das Level ist
  damage: number; // bei Berührung
  mass: number; // schwere Gegner fliegen kürzer und stoßen leichte stärker weg
  points: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  hunter: { name: 'Jagddrohne', r: 14, hp: 40, speed: 165, speedMax: 250, damage: 15, mass: 1, points: 100 },
  gunner: { name: 'Geschützdrohne', r: 14, hp: 30, speed: 115, speedMax: 170, damage: 0, mass: 1, points: 150 },
  shield: { name: 'Schilddrohne', r: 17, hp: 60, speed: 125, speedMax: 190, damage: 20, mass: 1.5, points: 200 },
  bomber: { name: 'Sprengdrohne', r: 13, hp: 20, speed: 225, speedMax: 290, damage: 0, mass: 0.8, points: 120 },
  heavy: { name: 'Schwerer Mech', r: 25, hp: 160, speed: 88, speedMax: 130, damage: 30, mass: 4, points: 400 },
  // Boss: so schwer, dass ein Kick ihn praktisch nicht bewegt
  boss: { name: 'Panzer', r: 46, hp: 900, speed: 52, speedMax: 80, damage: 30, mass: 12, points: 2000 },
};

// Skalierung mit dem Level (= Raumnummer, beginnend bei 1): je Level wächst der Wert um
// diesen Faktor, exponentiell. An diesen drei Zahlen wird im Balancing gedreht.
export const HP_GROWTH = 1.1; // Leben: Level 10 = ×2,4, Level 20 = ×6,1
export const DAMAGE_GROWTH = 1.06; // Schaden: Level 10 = ×1,7, Level 20 = ×3,0
export const SPEED_GROWTH = 1.03; // Tempo, begrenzt durch speedMax des Typs

/** Wie oft der Wachstumsfaktor greift: Level 1 ist der Grundwert. */
const stepsOf = (level: number) => Math.max(1, Math.floor(level)) - 1;

/** Schaden eines Gegners, der im gegebenen Level erschienen ist. Gilt für jeden Angriff, nicht nur die Berührung. */
export const scaledDamage = (base: number, level: number) => Math.round(base * DAMAGE_GROWTH ** stepsOf(level));

/** Die Werte eines Gegnertyps in einem Level. Sie werden beim Erscheinen festgelegt und ändern sich danach nicht. */
export function enemyStats(kind: EnemyKind, level: number) {
  const def = ENEMIES[kind];
  return {
    hp: Math.round(def.hp * HP_GROWTH ** stepsOf(level)),
    speed: Math.round(Math.min(def.speedMax, def.speed * SPEED_GROWTH ** stepsOf(level))),
    damage: scaledDamage(def.damage, level),
  };
}

export const BLAST_TIME = 0.5; // so lange ist eine Explosion zu sehen

// Punkte
const STYLE: Record<Source, number> = { gun: 1, dash: 1.5, kick: 1.5, env: 2 };
const MULTI_BONUS = 0.5; // Aufschlag auf den Art-Multiplikator je weiterem Kill mit derselben Aktion
const STREAK_STEP = 0.1; // Serien-Multiplikator pro Kill
const STREAK_MAX = 20; // ergibt höchstens ×3

export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
export const clampTo = (v: number, r: number) => Math.min(ARENA - r, Math.max(r, v));

export const levelOf = (g: Game): Level => (g.air > 0 ? 'high' : g.ducking ? 'low' : 'mid');

/** Sprunghöhe 0..1 für die Darstellung. */
export const jumpHeight = (g: Game) => (g.air > 0 ? Math.sin(Math.PI * (1 - g.air / JUMP_TIME)) : 0);

export const streakMultiplier = (g: Game) => 1 + Math.min(STREAK_MAX, g.streak) * STREAK_STEP;

/** Niedrige Gefahren überspringt man, hohe unterduckt man, volle treffen immer. */
export function heightHits(height: Height, level: Level) {
  if (height === 'low') return level !== 'high';
  if (height === 'high') return level !== 'low';
  return true;
}

/** Zufälliger Punkt im Raum mit Mindestabstand zur Figur. */
export function spot(g: Game, margin: number, distance: number) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < 50; i++) {
    x = rand(margin, ARENA - margin);
    y = rand(margin, ARENA - margin);
    if (Math.hypot(x - g.x, y - g.y) > distance) break;
  }
  return { x, y };
}

export function damageEnemy(e: Enemy, amount: number, source: Source, action = e.action) {
  if (e.dead) return;
  e.hp -= amount;
  e.hitFlash = 0.12;
  e.lastHit = source;
  e.action = action;
}

/** Schaden an der Figur. Gibt zurück, ob er gewirkt hat (I-Frames und Schonzeit schützen). */
export function hurtPlayer(g: Game, amount: number) {
  if (g.invuln > 0 || g.shield > 0 || g.phase !== 'play') return false;
  if (g.guard > 0) {
    // Schildgenerator: fängt den Treffer ab – kein Schaden, die Serie bleibt
    g.guard--;
    g.shield = SHIELD_TIME;
    g.popups.push({ x: g.x, y: g.y, text: 'Schild', t: 0.9 });
    return true;
  }
  g.hp -= Math.round(amount * g.stats.damageTaken);
  g.shield = SHIELD_TIME;
  g.hitFlash = 0.25;
  g.streak = 0; // ein Treffer beendet die Serie
  g.roomHit = true;
  g.events.push('hurt');
  return true;
}

export function award(g: Game, base: number, style: number, x: number, y: number) {
  const multiplier = style * streakMultiplier(g) * g.plan.multiplier;
  const points = Math.round(base * multiplier);
  g.score += points;
  g.popups.push({ x, y, text: multiplier > 1 ? `+${points} ×${multiplier.toFixed(1)}` : `+${points}`, t: 0.9 });
}

/** Punkte, Serie und Mehrfach-Aufschlag für einen besiegten Gegner. */
export function scoreKill(g: Game, e: Enemy) {
  let style = STYLE[e.lastHit];
  if (e.action > 0) {
    if (e.action === g.comboAction) {
      style += MULTI_BONUS * g.comboKills++;
    } else {
      g.comboAction = e.action;
      g.comboKills = 1;
    }
  }
  award(g, ENEMIES[e.kind].points, style, e.x, e.y);
  g.events.push('kill');
  g.kills++;
  g.roomKills++;
  g.streak++;
  g.streakTimer = g.stats.streakTime;
}

/**
 * Explosion: trifft alle Gegner im Radius (unabhängig von Kick und Höhe), auf
 * Wunsch die Figur, und zündet Minen und Fässer in Reichweite.
 */
export function explode(
  g: Game, x: number, y: number, radius: number,
  enemyDamage: number, playerDamage: number, source: Source, action: number, kind: BlastKind,
) {
  g.blasts.push({ x, y, r: radius, t: BLAST_TIME, kind });
  g.events.push('explode');
  for (const e of g.enemies) {
    const dx = e.x - x;
    const dy = e.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist >= radius + ENEMIES[e.kind].r) continue;
    damageEnemy(e, enemyDamage, source, action || e.action);
    if (!e.kicked) {
      e.pushX = ((dx / dist) * 500) / ENEMIES[e.kind].mass;
      e.pushY = ((dy / dist) * 500) / ENEMIES[e.kind].mass;
    }
  }
  if (playerDamage > 0 && Math.hypot(g.x - x, g.y - y) < radius + PLAYER_R) hurtPlayer(g, playerDamage);
  for (const m of g.mines) {
    if (m.fuse === null && Math.hypot(m.x - x, m.y - y) < radius) {
      m.fuse = 0.12;
      m.action = action;
    }
  }
  for (const b of g.barrels) {
    if (b.fuse === null && Math.hypot(b.x - x, b.y - y) < radius) {
      b.fuse = 0.12;
      b.action = action;
    }
  }
  for (const t of g.turrets) {
    if (Math.hypot(t.x - x, t.y - y) < radius + TURRET_R) {
      t.hp -= enemyDamage;
      t.hitFlash = 0.12;
    }
  }
}
