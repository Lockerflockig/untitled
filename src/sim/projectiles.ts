// Projektile beider Seiten in einem System.
//
// Jedes Projektil weiß, wer es abgefeuert hat (side). Daraus ergibt sich, wen
// es trifft: Projektile der Figur treffen Gegner und Gegenstände, Projektile
// von Gegnern treffen die Figur. Ein reflektiertes Projektil trifft beide.
//
// Abgefeuert wird alles über fireProjectiles – die Figur mit ihren Werten,
// Gegner über enemyFire mit abgeschwächten Werten. So können Gegner jede Waffe
// aus WEAPONS benutzen.

import { ARENA, STEP } from './types.ts';
import type { Bullet, Enemy, Game, Height, WeaponId } from './types.ts';
import {
  BARREL_R, ENEMIES, MINE_R, PLAYER_R, PYLON_R, TURRET_R, damageEnemy, damagePylon, explode, heightHits, hurtPlayer,
  levelOf, rand,
} from './core.ts';
import { WEAPONS } from './meta.ts';
import type { WeaponDef } from './meta.ts';

export const BULLET_R = 4; // Projektile der Figur
export const SHOT_R = 5; // Projektile von Gegnern
export const SHIELD_BLOCK = Math.cos(1.2); // Schilddrohne blockt, was aus ±70° von vorn kommt
const GRENADE_PLAYER_DAMAGE = 0; // die eigene Granate verletzt die Figur nicht
const HIT_PUSH = 170; // Rückstoß eines gewöhnlichen Treffers

// Gegner mit den Waffen der Figur: bewusst schwächer als das Original
export const ENEMY_SPEED_FACTOR = 0.45; // Geschosstempo
export const ENEMY_BLAST_FACTOR = 0.5; // Radius von Flächenschaden
const ENEMY_BEAM_CHARGE = 0.8; // s, so lange kündigt sich ein gegnerischer Strahl mindestens an
const ENEMY_SHOT_LIFE = 10; // s; einfache Geschosse fliegen bis zur Wand

const CHAIN_RANGE = 170;
const CHAIN_FALLOFF = 0.7; // jeder Sprung macht so viel vom vorigen Schaden

export interface FireOptions {
  side: Bullet['side'];
  x: number; // Ursprung
  y: number;
  angle: number;
  damage: number; // je Projektil
  spread: number; // ± rad
  height: Height; // auf welcher Höhe es fliegt – bestimmt, ob Ducken oder Springen ausweicht
  action?: number; // Aktion für den Mehrfach-Aufschlag
  reach?: number; // Sprenggeschosse landen in dieser Entfernung (höchstens in voller Reichweite)
  speedFactor?: number;
  blastFactor?: number;
  extraBounces?: number;
}

/** Feuert eine Waffe ab: erzeugt ihre Projektile mit allen Eigenschaften der Waffe. */
export function fireProjectiles(g: Game, w: WeaponDef, o: FireOptions) {
  for (let i = 0; i < w.pellets; i++) {
    const angle = o.angle + (Math.random() * 2 - 1) * o.spread;
    const speed = w.speed * (o.speedFactor ?? 1) * (w.pellets > 1 ? rand(0.85, 1) : 1);
    const life = w.life / (o.speedFactor ?? 1); // gleiche Reichweite bei anderem Tempo
    g.bullets.push({
      side: o.side,
      reflected: false,
      height: o.height,
      x: o.x,
      y: o.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: o.damage,
      life: w.blast > 0 && o.reach !== undefined ? Math.min(life, Math.max(0.05, o.reach / speed)) : life,
      maxLife: life,
      blast: w.blast * (o.blastFactor ?? 1),
      action: o.action ?? 0,
      look: w.look ?? 'bullet',
      hitR: w.hitR ?? 0,
      pierce: w.pierce ?? false,
      hit: [],
      // Querschläger gilt für alles außer Flammen und Sprenggeschossen
      bounces: (w.bounces ?? 0) + (w.blast > 0 || w.look === 'flame' ? 0 : o.extraBounces ?? 0),
      push: w.push ?? 0,
      chain: w.chain ?? 0,
    });
  }
}

/** Einfaches gegnerisches Geschoss ohne Waffe dahinter (Geschützdrohne, Boss-Fächer, Geschütz). */
export function enemyShot(g: Game, x: number, y: number, vx: number, vy: number, damage: number) {
  g.bullets.push({
    side: 'enemy', reflected: false, height: 'high',
    x, y, vx, vy, damage,
    life: ENEMY_SHOT_LIFE, maxLife: ENEMY_SHOT_LIFE,
    blast: 0, action: 0, look: 'shot', hitR: 0, pierce: false, hit: [], bounces: 0, push: 0, chain: 0,
  });
}

/**
 * Ein Gegner feuert eine Waffe aus WEAPONS in eine Richtung – langsamer und mit
 * kleinerem Flächenschaden als die Figur. Strahlenwaffen kündigen sich als
 * Strahl an, der kurz darauf feuert.
 * @param damage Schaden je Projektil, vom Aufrufer mit dem Level skaliert
 * @param reach  für Sprenggeschosse: Entfernung zum Ziel
 */
export function enemyFire(g: Game, e: Enemy, weapon: WeaponId, angle: number, damage: number, reach?: number) {
  const w = WEAPONS[weapon];
  const r = ENEMIES[e.kind].r;
  const x = e.x + Math.cos(angle) * r;
  const y = e.y + Math.sin(angle) * r;
  if (w.beam) {
    g.beams.push({
      ox: x, oy: y, dx: Math.cos(angle), dy: Math.sin(angle),
      phase: 'lock', t: Math.max(ENEMY_BEAM_CHARGE, w.beam.charge),
      damage, height: 'full',
    });
    return;
  }
  fireProjectiles(g, w, {
    side: 'enemy', x, y, angle, damage, spread: w.spread, height: 'high', reach,
    speedFactor: ENEMY_SPEED_FACTOR, blastFactor: ENEMY_BLAST_FACTOR,
  });
}

/** Kettenblitz: springt vom getroffenen Gegner zum jeweils nächsten in Reichweite. */
function chainFrom(g: Game, from: Enemy, damage: number, jumps: number, action: number) {
  const struck = [from];
  let last = from;
  for (let i = 0; i < jumps; i++) {
    let next: Enemy | null = null;
    let best = CHAIN_RANGE;
    for (const e of g.enemies) {
      const dist = Math.hypot(e.x - last.x, e.y - last.y);
      if (!e.dead && e.hp > 0 && !struck.includes(e) && dist < best) {
        best = dist;
        next = e;
      }
    }
    if (!next) return;
    g.arcs.push({ x1: last.x, y1: last.y, x2: next.x, y2: next.y, t: 0.15 });
    damageEnemy(next, damage, 'gun', action);
    damage *= CHAIN_FALLOFF;
    struck.push(next);
    last = next;
  }
}

export function stepBullets(g: Game) {
  const level = levelOf(g);
  g.bullets = g.bullets.filter((b) => {
    // Wen es trifft, folgt aus dem Besitzer; reflektiert trifft es beide Seiten
    const hitsEnemies = b.side === 'player' || b.reflected;
    const hitsPlayer = b.side === 'enemy' || b.reflected;
    // Was ein Gegner-Projektil (oder ein reflektiertes) unter Gegnern anrichtet, zählt als Umgebung
    const fromPlayer = b.side === 'player' && !b.reflected;

    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
    b.life -= STEP;
    const detonate = () => {
      if (b.blast > 0) {
        // Die eigene Granate verschont die Figur; alles andere trifft, wen es erwischt
        explode(g, b.x, b.y, b.blast, b.damage, fromPlayer ? GRENADE_PLAYER_DAMAGE : b.damage,
          fromPlayer ? 'gun' : 'env', b.action, 'grenade');
      }
      return false;
    };
    if (b.life <= 0) return detonate();
    if (b.x < 0 || b.x > ARENA || b.y < 0 || b.y > ARENA) {
      if (b.bounces <= 0) return detonate();
      // Abprall: zurück in den Raum, Richtung spiegeln; danach kann es dieselben Gegner erneut treffen
      b.bounces--;
      if (b.x < 0 || b.x > ARENA) b.vx = -b.vx;
      if (b.y < 0 || b.y > ARENA) b.vy = -b.vy;
      b.x = Math.min(ARENA, Math.max(0, b.x));
      b.y = Math.min(ARENA, Math.max(0, b.y));
      b.hit = [];
    }

    if (hitsEnemies) {
      for (const e of g.enemies) {
        if (e.dead || e.hp <= 0 || b.hit.includes(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) >= ENEMIES[e.kind].r + BULLET_R + b.hitR) continue;
        const speed = Math.hypot(b.vx, b.vy);
        // Die Schilddrohne blockt, was von vorn kommt
        const fromFront = -(b.vx / speed) * Math.cos(e.angle) - (b.vy / speed) * Math.sin(e.angle) > SHIELD_BLOCK;
        if (e.kind === 'shield' && fromFront && !e.kicked) {
          e.hitFlash = 0.05;
          return detonate();
        }
        if (b.blast > 0) return detonate();
        if (fromPlayer) g.events.push('hit');
        if (b.push > 0) {
          // Impuls: schleudert wie ein Kick – Aufprall, Domino und Laser greifen danach wie gewohnt
          damageEnemy(e, b.damage, fromPlayer ? 'kick' : 'env', b.action);
          e.pushX = ((b.vx / speed) * b.push) / ENEMIES[e.kind].mass;
          e.pushY = ((b.vy / speed) * b.push) / ENEMIES[e.kind].mass;
          e.kicked = true;
        } else {
          damageEnemy(e, b.damage, fromPlayer ? 'gun' : 'env', b.action);
          if (!e.kicked && b.look !== 'flame') {
            e.pushX = ((b.vx / speed) * HIT_PUSH) / ENEMIES[e.kind].mass;
            e.pushY = ((b.vy / speed) * HIT_PUSH) / ENEMIES[e.kind].mass;
          }
        }
        if (b.chain > 0) chainFrom(g, e, b.damage * CHAIN_FALLOFF, b.chain, b.action);
        if (!b.pierce) return false;
        b.hit.push(e);
      }
      for (const t of g.turrets) {
        if (Math.hypot(t.x - b.x, t.y - b.y) < TURRET_R + BULLET_R) {
          if (b.blast > 0) return detonate();
          t.hp -= b.damage;
          t.hitFlash = 0.12;
          return false;
        }
      }
      // Der Sendemast fängt Geschosse ab wie ein Geschütz
      if (g.pylon && Math.hypot(g.pylon.x - b.x, g.pylon.y - b.y) < PYLON_R + BULLET_R) {
        if (b.blast > 0) return detonate();
        damagePylon(g, b.damage);
        return false;
      }
      for (const m of g.mines) {
        if (m.fuse === null && Math.hypot(m.x - b.x, m.y - b.y) < MINE_R + BULLET_R) {
          m.fuse = 0;
          m.action = b.action;
          return detonate();
        }
      }
      for (const barrel of g.barrels) {
        if (barrel.fuse === null && Math.hypot(barrel.x - b.x, barrel.y - b.y) < BARREL_R + BULLET_R) {
          barrel.fuse = 0;
          barrel.action = b.action;
          return detonate();
        }
      }
    }

    if (hitsPlayer && Math.hypot(g.x - b.x, g.y - b.y) < PLAYER_R + SHOT_R + b.hitR && heightHits(b.height, level)) {
      if (b.blast > 0) return detonate();
      // I-Frames lassen das Projektil durchfliegen, ein Treffer verbraucht es
      if (hurtPlayer(g, b.damage) && !b.pierce) return false;
    }
    return true;
  });
}
