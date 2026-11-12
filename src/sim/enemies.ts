// Gegner: Erscheinen, Verhalten je Typ, Kick-Flug, Domino, Wracks.

import { STEP } from './types.ts';
import type { Alarm, Enemy, EnemyKind, Game } from './types.ts';
import {
  BARREL_R, ENEMIES, PLAYER_R, TURRET_R, clampTo, damageEnemy, enemyStats, explode, hurtPlayer, scaledDamage,
  scoreKill, spot,
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
// Wie viel Schwung beim Domino weitergeht, steht in stats.transfer (normal 0,8).

/** Sprengkick: Ein gekickter Gegner explodiert, wo er aufprallt. Die Figur bleibt verschont. */
function impactBlast(g: Game, e: Enemy) {
  if (g.stats.kickBlast > 0) explode(g, e.x, e.y, g.stats.kickBlast, g.stats.kickBlastDamage, 0, 'env', e.action, 'bomb');
}

// Nahkampf-Angriff. Jede Drohne mit Eintrag in MELEE verletzt nicht durch Berührung, sondern
// holt aus, schlägt in einen Bogen vor sich und erholt sich. Die Werte skalieren nicht mit
// dem Level; der Schaden kommt aus e.damage. Weitere Nahkämpfer tragen hier ihre Werte ein.
export interface MeleeDef {
  windup: number; // s – sie bleibt stehen und zeigt die Angriffsanimation; die Richtung steht zu Beginn fest
  recover: number; // s – nach dem Schlag steht sie und kann nicht angreifen
  reach: number; // px ab Rand der Drohne; zusätzlich zählt der Körper der Figur
  arc: number; // rad – halber Öffnungswinkel des Schlags
}
export const MELEE: Partial<Record<EnemyKind, MeleeDef>> = {
  hunter: { windup: 0.35, recover: 0.5, reach: 50, arc: Math.PI / 3 },
};
const MELEE_INTERRUPT = 60; // px/s – ein Rückstoß darüber (Kick, Treffer, Dash, Explosion) bricht das Ausholen ab

// Geschützdrohne
const GUNNER_RANGE: [number, number] = [260, 340]; // hält diesen Abstand
const GUNNER_COOLDOWN = 1.1;
export const GUNNER_WINDUP = 0.4; // zielt sichtbar, bevor sie feuert
const GUNNER_SHOT_SPEED = 380;
const GUNNER_SHOT_DAMAGE = 12;

// Schilddrohne
export const SHIELD_TURN = 2.2; // rad/s – langsam genug, um sie zu umlaufen; skaliert nicht mit dem Level
export const SHIELD_BLAST_RADIUS = 90; // px – Explosion beim Zerstören, die Drohne kündigt sie nicht an
const SHIELD_BLAST_DAMAGE = 25; // in Level 1, für Figur und Gegner gleich; wächst mit dem Level

// Sprengdrohne
export const BOMB_SPEED = 1.5; // Faktor auf das Höchsttempo der Figur: immer schneller als sie, skaliert nicht mit dem Level
const BOMB_TRIGGER = 70;
export const BOMB_FUSE = 0.6;
export const BOMB_RADIUS = 160; // px
const BOMB_DAMAGE = 30; // an der Figur, in Level 1
const BOMB_ENEMY_DAMAGE = 40; // an Gegnern, in Level 1

// Boss (Panzer)
const BOSS_COOLDOWN = 1.6;
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

/** Neuer Gegner. Leben, Tempo und Schaden hängen vom Level ab und gelten danach unverändert. */
export function makeEnemy(kind: EnemyKind, x: number, y: number, level = 1): Enemy {
  const stats = enemyStats(kind, level);
  return {
    kind, level, x, y, hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage, mode: 0,
    pushX: 0, pushY: 0, kicked: false, dead: false, suicide: false,
    lastHit: 'gun', action: 0, hitFlash: 0, dashHit: false, slideHit: false, laserCooldown: 0,
    cooldown: GUNNER_COOLDOWN, windup: 0, melee: null, fuse: null, angle: 0,
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
    g.enemies.push(makeEnemy(s.kind, s.x, s.y, g.room));
    return false;
  });
}

/**
 * Welche Dauertöne gerade laufen sollen. Die Oberfläche fragt das jeden Frame ab und
 * startet oder beendet die Schleifen entsprechend. Neue Quellen (etwa ein Sendemast)
 * tragen hier ihre Bedingung mit eigener Art ein.
 */
export function alarmsOf(g: Game): Alarm[] {
  const alarms: Alarm[] = [];
  if (g.over || g.phase !== 'play') return alarms;
  // Eine Sprengdrohne läuft auf die Figur zu, solange sie im Raum ist, lebt und nicht fliegt.
  // Mit brennender Lunte wird der Ton dringlicher.
  const chasing = g.enemies.filter((e) => e.kind === 'bomber' && !e.dead && !e.kicked);
  if (chasing.length > 0) {
    const urgency = Math.max(...chasing.map((e) => (e.fuse === null ? 0 : 0.5 + 0.5 * (1 - e.fuse / BOMB_FUSE))));
    alarms.push({ kind: 'beep', urgency: Math.min(1, Math.max(0, urgency)) });
  }
  return alarms;
}

/** Trifft der Schlag aus Richtung angle die Figur? Reichweite wie beim Kick: ab Rand der Drohne, Körper der Figur zählt. */
function strikeHits(g: Game, e: Enemy, def: MeleeDef, angle: number) {
  const dx = g.x - e.x;
  const dy = g.y - e.y;
  if (Math.hypot(dx, dy) >= ENEMIES[e.kind].r + def.reach + PLAYER_R) return false;
  const off = Math.atan2(dy, dx) - angle;
  return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) <= def.arc;
}

/**
 * Nahkampf-Angriff eines Gegners für einen Schritt. Gibt zurück, ob er dabei stehen
 * bleibt (Ausholen und Erholen).
 */
function stepMelee(g: Game, e: Enemy, def: MeleeDef, dx: number, dy: number, dist: number): boolean {
  const pushed = Math.hypot(e.pushX, e.pushY) >= MELEE_INTERRUPT;
  if (e.melee === null) {
    // Sie holt aus, sobald die Figur in Reichweite des Schlags ist – nicht, solange sie zurückgeworfen wird
    if (pushed || dist >= ENEMIES[e.kind].r + def.reach + PLAYER_R) return false;
    e.melee = { phase: 'windup', t: def.windup, angle: Math.atan2(dy, dx) };
    return true;
  }
  const m = e.melee;
  if (m.phase === 'windup' && pushed) {
    e.melee = null; // ein Rückstoß wirft das Ausholen ab
    return false;
  }
  m.t -= STEP;
  if (m.t > 0) return true;
  if (m.phase === 'windup') {
    // Schlag: trifft, wer im Bogen steht. I-Frames des Dashs und die Schonzeit schützen wie sonst.
    if (!g.dashing && strikeHits(g, e, def, m.angle)) hurtPlayer(g, e.damage);
    m.phase = 'recover';
    m.t = def.recover;
  } else {
    e.melee = null;
  }
  return true;
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
    const melee = MELEE[e.kind];
    // Nahkämpfer: Während des Angriffs steht er; gekickt oder tot greift er nicht an
    const attacking = melee !== undefined && !e.kicked && !e.dead && stepMelee(g, e, melee, dx, dy, dist);
    if (e.kicked || e.dead) e.melee = null;
    if (!e.kicked && !e.dead) {
      switch (e.kind) {
        case 'hunter':
          if (!attacking) {
            moveX = toX * e.speed;
            moveY = toY * e.speed;
          }
          break;
        case 'heavy':
          moveX = toX * e.speed;
          moveY = toY * e.speed;
          break;
        case 'shield': {
          moveX = toX * e.speed;
          moveY = toY * e.speed;
          // richtet den Schild nur langsam zur Figur aus
          let turn = Math.atan2(dy, dx) - e.angle;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          e.angle += Math.max(-SHIELD_TURN * STEP, Math.min(SHIELD_TURN * STEP, turn));
          break;
        }
        case 'boss':
          // Rollt langsam auf die Figur zu und wechselt zwei angekündigte Angriffe ab
          moveX = toX * e.speed;
          moveY = toY * e.speed;
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
            // schneller als die Figur, egal wie schnell sie ist (Upgrades, Charakter)
            moveX = toX * g.stats.speed * BOMB_SPEED;
            moveY = toY * g.stats.speed * BOMB_SPEED;
            if (dist < BOMB_TRIGGER) e.fuse = BOMB_FUSE;
          }
          break;
        case 'gunner': {
          // hält Abstand und umkreist die Figur
          const [near, far] = GUNNER_RANGE;
          const radial = dist > far ? 1 : dist < near ? -1 : 0;
          moveX = (toX * radial - toY * 0.5) * e.speed;
          moveY = (toY * radial + toX * 0.5) * e.speed;
          if (e.windup > 0) {
            moveX = moveY = 0; // steht beim Zielen still
            e.windup -= STEP;
            if (e.windup <= 0) {
              g.shots.push({
                x: e.x + toX * def.r, y: e.y + toY * def.r,
                vx: toX * GUNNER_SHOT_SPEED, vy: toY * GUNNER_SHOT_SPEED,
                damage: scaledDamage(GUNNER_SHOT_DAMAGE, e.level),
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
    // Die Lunte der Sprengdrohne läuft auch im Flug weiter. Wer sie in diesem Schritt
    // schon zerstört hat (hp <= 0), war schneller als die Lunte.
    if (e.fuse !== null && !e.dead) {
      e.fuse -= STEP;
      if (e.fuse <= 0 && e.hp > 0) {
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
    } else if (g.sliding && g.stats.slideDamage > 0 && !e.dead && dist < PLAYER_R + def.r + DASH_REACH) {
      // Gleitschuhe: Der Slide trifft jeden Gegner einmal und schiebt ihn beiseite
      if (!e.slideHit) {
        e.slideHit = true;
        damageEnemy(e, g.stats.slideDamage, 'dash', g.actionId);
        if (!e.kicked) {
          e.pushX = (-toX * KNOCKBACK) / def.mass;
          e.pushY = (-toY * KNOCKBACK) / def.mass;
        }
      }
    } else if (!g.dashing && !e.kicked && e.damage > 0 && !melee && dist < PLAYER_R + def.r) {
      if (hurtPlayer(g, e.damage)) {
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
        impactBlast(g, e);
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
      const passed = along * g.stats.transfer * Math.min(1, massRatio);
      target.pushX = nx * passed;
      target.pushY = ny * passed;
      target.kicked = passed >= KICK_END;
      impactBlast(g, flyer);
    }
  }

  g.enemies = g.enemies.filter((e) => {
    if (e.hp > 0) return true;
    // Stirbt ein Gegner im Flug, fliegt sein Wrack weiter und kann andere
    // treffen. Es verschwindet erst, wenn es ausrollt oder aufprallt.
    if (e.dead) return e.kicked;
    e.dead = true;
    if (!e.suicide) scoreKill(g, e);
    if (e.kind === 'shield') {
      // Die Schilddrohne explodiert, wo sie zerstört wird – auch im Flug, ein Wrack bleibt nicht.
      // Die Aktion des auslösenden Kills gilt weiter (Mehrfach-Aufschlag); Opfer zählen als Umgebung.
      const damage = scaledDamage(SHIELD_BLAST_DAMAGE, e.level);
      explode(g, e.x, e.y, SHIELD_BLAST_RADIUS, damage, damage, 'env', e.action, 'shield');
      g.marks.push({ x: e.x, y: e.y, r: SHIELD_BLAST_RADIUS });
      return false;
    }
    if (e.kind === 'bomber') {
      // Sie explodiert nur, wenn ihre Lunte abläuft (dann gibt es keine Punkte). Wer sie vorher
      // zerstört – egal wodurch –, bekommt die Punkte, und sie verschwindet ohne Explosion.
      if (e.suicide) {
        explode(
          g, e.x, e.y, BOMB_RADIUS, scaledDamage(BOMB_ENEMY_DAMAGE, e.level), scaledDamage(BOMB_DAMAGE, e.level),
          'env', e.action, 'bomb',
        );
      }
      return false;
    }
    return e.kicked;
  });
}
