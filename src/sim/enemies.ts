// Gegner: Erscheinen, Verhalten je Typ, Kick-Flug, Domino, Wracks.

import { STEP } from './types.ts';
import type { Enemy, EnemyKind, Game } from './types.ts';
import {
  BARREL_R, ENEMIES, PLAYER_R, TURRET_R, clampTo, damageEnemy, explode, hurtPlayer, scoreKill, spot,
} from './core.ts';
import { FIELD_ACTIVE, FIELD_RADIUS, FIELD_WARN } from './hazards.ts';

export const SPAWN_WARN = 0.9; // so lange kündigt sich ein Gegner an
const SPAWN_DISTANCE = 280; // Mindestabstand zur Figur
const DASH_REACH = 6; // so viel breiter als die Figur trifft der Dash

const KNOCKBACK = 420;
const KNOCKBACK_DECAY = 8;
// Kick-Flug: bewusst überspitzt – hohes Anfangstempo (stats.kickForce), das zügig abklingt
const KICK_DECAY = 4;
const KICK_END = 150; // px/s, darunter fängt sich der Gegner wieder
const WALL_IMPACT = 30; // Schaden beim Aufprall auf Wand oder Geschütz
const ENEMY_IMPACT = 20; // Schaden für beide beim Aufprall auf einen anderen Gegner
const IMPACT_MIN = 80; // px/s in Stoßrichtung, darunter zählt es nicht als Aufprall
const IMPACT_TRANSFER = 0.8; // Anteil des Schwungs, der auf den getroffenen Gegner übergeht

// Geschützdrohne
const GUNNER_RANGE: [number, number] = [260, 340]; // hält diesen Abstand
const GUNNER_COOLDOWN = 1.6;
export const GUNNER_WINDUP = 0.4; // zielt sichtbar, bevor sie feuert
const GUNNER_SHOT_SPEED = 320;
const GUNNER_SHOT_DAMAGE = 12;

// Schild-Mech
const SHIELD_TURN = 2.2; // rad/s – langsam genug, um ihn zu umlaufen

// Sprengdrohne
const BOMB_TRIGGER = 70;
export const BOMB_FUSE = 0.6;
const BOMB_RADIUS = 80;
const BOMB_DAMAGE = 30; // an der Figur
const BOMB_ENEMY_DAMAGE = 40;

// Boss (Panzer)
const BOSS_COOLDOWN = 2.2;
export const BOSS_WINDUP = 0.7; // kündigt jeden Angriff an
const BOSS_FAN = 7; // Geschosse pro Fächer
const BOSS_FAN_STEP = 0.17; // rad zwischen zwei Geschossen
const BOSS_SHOT_SPEED = 300;
const BOSS_SHOT_DAMAGE = 15;

function pickKind(g: Game): EnemyKind {
  const total = g.plan.mix.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [kind, weight] of g.plan.mix) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return g.plan.mix[0][0];
}

export function makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  return {
    kind, x, y, hp: ENEMIES[kind].hp, maxHp: ENEMIES[kind].hp, mode: 0,
    pushX: 0, pushY: 0, kicked: false, dead: false, suicide: false,
    lastHit: 'gun', action: 0, hitFlash: 0, dashHit: false, laserCooldown: 0,
    cooldown: GUNNER_COOLDOWN, windup: 0, fuse: null, angle: 0,
  };
}

/** Neue Gegner erscheinen mit Vorwarnung. */
export function stepSpawns(g: Game) {
  g.spawnTimer -= STEP;
  if (g.spawnTimer <= 0 && g.enemies.length + g.spawns.length < g.plan.maxEnemies) {
    g.spawnTimer = g.plan.spawnEvery;
    g.spawns.push({ ...spot(g, 40, SPAWN_DISTANCE), t: SPAWN_WARN, kind: pickKind(g) });
  }
  g.spawns = g.spawns.filter((s) => {
    s.t -= STEP;
    if (s.t > 0) return true;
    g.enemies.push(makeEnemy(s.kind, s.x, s.y));
    return false;
  });
}

export function stepEnemies(g: Game) {
  for (const e of g.enemies) {
    const def = ENEMIES[e.kind];
    e.hitFlash = Math.max(0, e.hitFlash - STEP);
    e.laserCooldown = Math.max(0, e.laserCooldown - STEP);
    const dx = g.x - e.x;
    const dy = g.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const toX = dx / dist;
    const toY = dy / dist;

    // Verhalten – gekickte Gegner und Wracks fliegen nur
    let moveX = 0;
    let moveY = 0;
    if (!e.kicked && !e.dead) {
      switch (e.kind) {
        case 'hunter':
        case 'heavy':
          moveX = toX * def.speed;
          moveY = toY * def.speed;
          break;
        case 'shield': {
          moveX = toX * def.speed;
          moveY = toY * def.speed;
          // dreht den Schild nur langsam zur Figur
          let turn = Math.atan2(dy, dx) - e.angle;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          e.angle += Math.max(-SHIELD_TURN * STEP, Math.min(SHIELD_TURN * STEP, turn));
          break;
        }
        case 'boss':
          // Rollt langsam auf die Figur zu und wechselt zwei angekündigte Angriffe ab
          moveX = toX * def.speed;
          moveY = toY * def.speed;
          if (e.windup > 0) {
            moveX = moveY = 0;
            e.windup -= STEP;
            if (e.windup <= 0) {
              if (e.mode % 2 === 0) {
                // Fächer aus hohen Geschossen – ducken oder sliden
                const base = Math.atan2(dy, dx);
                for (let i = 0; i < BOSS_FAN; i++) {
                  const a = base + (i - (BOSS_FAN - 1) / 2) * BOSS_FAN_STEP;
                  g.shots.push({
                    x: e.x + Math.cos(a) * def.r, y: e.y + Math.sin(a) * def.r,
                    vx: Math.cos(a) * BOSS_SHOT_SPEED, vy: Math.sin(a) * BOSS_SHOT_SPEED,
                    damage: BOSS_SHOT_DAMAGE,
                  });
                }
              } else {
                // Drei Bodenfelder um die Figur – springen oder raus
                for (let i = 0; i < 3; i++) {
                  const a = (i / 3) * Math.PI * 2 + e.mode;
                  g.fields.push({
                    x: clampTo(g.x + Math.cos(a) * 75, FIELD_RADIUS),
                    y: clampTo(g.y + Math.sin(a) * 75, FIELD_RADIUS),
                    r: FIELD_RADIUS, warn: FIELD_WARN, active: FIELD_ACTIVE,
                  });
                }
              }
              e.mode++;
              e.cooldown = BOSS_COOLDOWN;
            }
          } else {
            e.cooldown -= STEP;
            if (e.cooldown <= 0) e.windup = BOSS_WINDUP;
          }
          break;
        case 'bomber':
          if (e.fuse === null) {
            moveX = toX * def.speed;
            moveY = toY * def.speed;
            if (dist < BOMB_TRIGGER) e.fuse = BOMB_FUSE;
          }
          break;
        case 'gunner': {
          // hält Abstand und umkreist die Figur
          const [near, far] = GUNNER_RANGE;
          const radial = dist > far ? 1 : dist < near ? -1 : 0;
          moveX = (toX * radial - toY * 0.5) * def.speed;
          moveY = (toY * radial + toX * 0.5) * def.speed;
          if (e.windup > 0) {
            moveX = moveY = 0; // steht beim Zielen still
            e.windup -= STEP;
            if (e.windup <= 0) {
              g.shots.push({
                x: e.x + toX * def.r, y: e.y + toY * def.r,
                vx: toX * GUNNER_SHOT_SPEED, vy: toY * GUNNER_SHOT_SPEED,
                damage: GUNNER_SHOT_DAMAGE,
              });
              e.cooldown = GUNNER_COOLDOWN;
            }
          } else {
            e.cooldown -= STEP;
            if (e.cooldown <= 0) e.windup = GUNNER_WINDUP;
          }
          break;
        }
      }
    }
    // Die Lunte der Sprengdrohne läuft auch im Flug weiter
    if (e.fuse !== null && !e.dead) {
      e.fuse -= STEP;
      if (e.fuse <= 0) {
        e.hp = 0;
        e.suicide = true;
      }
    }

    e.x += (moveX + e.pushX) * STEP;
    e.y += (moveY + e.pushY) * STEP;
    const decay = Math.exp(-(e.kicked ? KICK_DECAY : KNOCKBACK_DECAY) * STEP);
    e.pushX *= decay;
    e.pushY *= decay;
    if (e.kicked && Math.hypot(e.pushX, e.pushY) < KICK_END) e.kicked = false;

    // Dash trifft, Berührung verletzt
    if (g.dashing && !e.dashHit && !e.dead && dist < PLAYER_R + def.r + DASH_REACH) {
      e.dashHit = true;
      damageEnemy(e, g.stats.dashDamage, 'dash', g.actionId);
      if (!e.kicked) {
        e.pushX = (g.dashX * KNOCKBACK) / def.mass;
        e.pushY = (g.dashY * KNOCKBACK) / def.mass;
      }
    } else if (!g.dashing && !e.kicked && def.damage > 0 && dist < PLAYER_R + def.r) {
      if (hurtPlayer(g, def.damage)) {
        e.pushX = (-toX * KNOCKBACK) / def.mass;
        e.pushY = (-toY * KNOCKBACK) / def.mass;
      }
    }

    if (e.kicked) {
      // Aufprall auf Geschütz oder Fass
      for (const t of g.turrets) {
        if (Math.hypot(t.x - e.x, t.y - e.y) < TURRET_R + def.r) {
          t.hp -= WALL_IMPACT * g.stats.impact * def.mass;
          t.hitFlash = 0.12;
          damageEnemy(e, WALL_IMPACT * g.stats.impact, 'env');
          e.kicked = false;
          e.pushX = e.pushY = 0;
        }
      }
      for (const b of g.barrels) {
        if (b.fuse === null && Math.hypot(b.x - e.x, b.y - e.y) < BARREL_R + def.r) {
          b.fuse = 0;
          b.action = e.action;
        }
      }
      // Aufprall auf die Wand
      if (e.kicked && (e.x !== clampTo(e.x, def.r) || e.y !== clampTo(e.y, def.r))) {
        damageEnemy(e, WALL_IMPACT * g.stats.impact, 'env');
        e.kicked = false;
        e.pushX = e.pushY = 0;
      }
    }
    e.x = clampTo(e.x, def.r);
    e.y = clampTo(e.y, def.r);
  }

  // Gegner schieben sich auseinander; ein fliegender richtet dabei Schaden an
  for (let i = 0; i < g.enemies.length; i++) {
    for (let j = i + 1; j < g.enemies.length; j++) {
      const a = g.enemies[i];
      const b = g.enemies[j];
      const ra = ENEMIES[a.kind].r;
      const rb = ENEMIES[b.kind].r;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const overlap = ra + rb - dist;
      if (overlap <= 0) continue;
      a.x -= (dx / dist) * overlap * 0.5;
      a.y -= (dy / dist) * overlap * 0.5;
      b.x += (dx / dist) * overlap * 0.5;
      b.y += (dy / dist) * overlap * 0.5;
      // Aufprall gibt es nur, wenn ein fliegender Gegner einen stehenden trifft.
      // Zwei gemeinsam gekickte fliegen nebeneinander her und stoßen sich nicht.
      if (a.kicked === b.kicked) continue;
      const flyer = a.kicked ? a : b;
      const target = a.kicked ? b : a;
      const massRatio = ENEMIES[flyer.kind].mass / ENEMIES[target.kind].mass;
      // Stoßrichtung vom fliegenden zum getroffenen Gegner (dx/dist zeigt von a nach b)
      const nx = (a.kicked ? dx : -dx) / dist;
      const ny = (a.kicked ? dy : -dy) / dist;
      // Domino: Der Schwung in Stoßrichtung geht (mit Verlust) auf den getroffenen
      // Gegner über, der dann selbst fliegt und weitere treffen kann. Der
      // fliegende behält nur, was quer zur Stoßrichtung liegt.
      const along = flyer.pushX * nx + flyer.pushY * ny;
      if (along < IMPACT_MIN) continue;
      const action = flyer.action;
      damageEnemy(flyer, ENEMY_IMPACT * g.stats.impact, 'env');
      damageEnemy(target, ENEMY_IMPACT * g.stats.impact * Math.max(1, massRatio), 'env', action);
      flyer.pushX -= nx * along;
      flyer.pushY -= ny * along;
      flyer.kicked = Math.hypot(flyer.pushX, flyer.pushY) >= KICK_END;
      const passed = along * IMPACT_TRANSFER * Math.min(1, massRatio);
      target.pushX = nx * passed;
      target.pushY = ny * passed;
      target.kicked = passed >= KICK_END;
    }
  }

  g.enemies = g.enemies.filter((e) => {
    if (e.hp > 0) return true;
    // Stirbt ein Gegner im Flug, fliegt sein Wrack weiter und kann andere
    // treffen. Es verschwindet erst, wenn es ausrollt oder aufprallt.
    if (e.dead) return e.kicked;
    e.dead = true;
    if (!e.suicide) scoreKill(g, e);
    if (e.kind === 'bomber') {
      // Sprengdrohnen detonieren immer – auch abgeschossen oder weggekickt
      explode(g, e.x, e.y, BOMB_RADIUS, BOMB_ENEMY_DAMAGE, BOMB_DAMAGE, 'env', e.action, 'bomb');
      return false;
    }
    return e.kicked;
  });
}
