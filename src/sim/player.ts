// Die Figur: Zielen, Laufen, Springen/Ducken/Slide, Dash, Waffen, Kick.

import { STEP, ARENA } from './types.ts';
import type { Game, Input } from './types.ts';
import {
  BARREL_R, ENEMIES, JUMP_TIME, MINE_R, PLAYER_R, TURRET_R, clampTo, damageEnemy, explode, rand,
} from './core.ts';
import { WEAPONS } from './meta.ts';

const BACKPEDAL = 0.85; // Anteil des Höchsttempos beim Laufen entgegen der Blickrichtung
const ACCEL = 1800; // px/s², solange eine Richtung gehalten wird (auch beim Wenden)
const BRAKE = 2400; // px/s², wenn keine Richtung gehalten wird
const LOOK_BRAKE = 400; // px/s², wenn nur der Blickwinkel das Höchsttempo senkt

const DUCK_SPEED = 0.4; // Anteil des Lauftempos beim Ducken
const SLIDE_MIN = 0.4; // ab diesem Anteil des Höchsttempos wird Ducken zum Slide
const SLIDE_FRICTION = 350; // px/s²
const SLIDE_END = 50; // px/s, darunter endet der Slide

const DASH_SPEED = 1400;

export const KICK_REACH = 55; // ab Rand der Figur
export const KICK_ARC = 0.96; // halber Öffnungswinkel in rad (55°)
const KICK_DAMAGE = 5;

export const BULLET_R = 4;
const SHIELD_BLOCK = Math.cos(1.2); // Schild-Mech blockt Schüsse aus ±70° von vorn
const GRENADE_PLAYER_DAMAGE = 0; // die eigene Granate verletzt die Figur nicht

/**
 * Laufen: Die Geschwindigkeit nähert sich der gewünschten mit begrenzter Rate an.
 * Daraus folgt: Anlaufen aus dem Stand, Tempoverlust und Ausschwingen in Kurven,
 * und beim Umkehren erst abbremsen, dann neu beschleunigen.
 */
function steer(g: Game, input: Input, moveLen: number) {
  let targetX = 0;
  let targetY = 0;
  if (moveLen > 0) {
    // Das Höchsttempo hängt vom Winkel zwischen Lauf- und Blickrichtung ab:
    // 100 % geradeaus, linear fallend bis BACKPEDAL beim Rückwärtslaufen.
    const dirX = input.moveX / moveLen;
    const dirY = input.moveY / moveLen;
    const angle = Math.acos(Math.min(1, Math.max(-1, dirX * g.aimX + dirY * g.aimY)));
    const topSpeed = g.stats.speed * (1 - (1 - BACKPEDAL) * (angle / Math.PI));
    // Zwei getrennte Bremsen: Ändert sich die Laufrichtung (WASD), greift unten
    // ACCEL. Sinkt nur das Höchsttempo, weil sich der Blickwinkel ändert, gibt
    // das Tempolimit mit LOOK_BRAKE deutlich sanfter nach. Nach oben folgt das
    // Limit sofort; aus dem Stand gilt direkt das Höchsttempo der Richtung.
    const speedNow = Math.hypot(g.vx, g.vy);
    g.speedLimit = Math.max(topSpeed, Math.min(g.speedLimit - LOOK_BRAKE * STEP, speedNow));
    const speed = g.speedLimit * (g.ducking ? DUCK_SPEED : 1);
    targetX = dirX * speed;
    targetY = dirY * speed;
  } else {
    g.speedLimit = Infinity;
  }
  const dx = targetX - g.vx;
  const dy = targetY - g.vy;
  const diff = Math.hypot(dx, dy);
  const change = (moveLen > 0 ? ACCEL : BRAKE) * STEP;
  if (diff <= change) {
    g.vx = targetX;
    g.vy = targetY;
  } else {
    g.vx += (dx / diff) * change;
    g.vy += (dy / diff) * change;
  }
}

export function stepPlayer(g: Game, input: Input) {
  const s = g.stats;
  g.prevX = g.x;
  g.prevY = g.y;
  g.invuln = Math.max(0, g.invuln - STEP);
  g.shield = Math.max(0, g.shield - STEP);
  g.hitFlash = Math.max(0, g.hitFlash - STEP);
  g.kickCooldown = Math.max(0, g.kickCooldown - STEP);
  g.kickFlash = Math.max(0, g.kickFlash - STEP);
  for (let i = 0; i < g.weaponCooldown.length; i++) g.weaponCooldown[i] = Math.max(0, g.weaponCooldown[i] - STEP);
  // Dash-Ladungen füllen sich einzeln nach
  if (g.dashes < s.dashCharges) {
    g.dashRecharge -= STEP;
    if (g.dashRecharge <= 0) {
      g.dashes++;
      g.dashRecharge = s.dashRecharge;
    }
  }

  // Zielen
  const aimLen = Math.hypot(input.aimX - g.x, input.aimY - g.y);
  if (aimLen > 1) {
    g.aimX = (input.aimX - g.x) / aimLen;
    g.aimY = (input.aimY - g.y) / aimLen;
  }

  // Dash: immer in Zielrichtung
  const moveLen = Math.hypot(input.moveX, input.moveY);
  if (input.dash && g.dashes > 0 && g.dashTime <= 0) {
    if (g.dashes === s.dashCharges) g.dashRecharge = s.dashRecharge;
    g.dashes--;
    g.dashTime = s.dashTime;
    g.invuln = Math.max(g.invuln, s.dashIframes);
    g.dashX = g.aimX;
    g.dashY = g.aimY;
    g.events.push('dash');
    g.actionId++;
    for (const e of g.enemies) e.dashHit = false;
    for (const t of g.turrets) t.dashHit = false;
  }
  g.dashing = g.dashTime > 0;
  if (g.dashing) {
    g.dashTime -= STEP;
    g.x += g.dashX * DASH_SPEED * STEP;
    g.y += g.dashY * DASH_SPEED * STEP;
    // aus dem Dash kommt die Figur mit vollem Lauftempo heraus
    g.vx = g.dashX * s.speed;
    g.vy = g.dashY * s.speed;
    g.sliding = false;
    g.speedLimit = Infinity;
  } else {
    if (g.air > 0) {
      // In der Luft bleibt die Geschwindigkeit, wie sie beim Absprung war.
      g.air -= STEP;
    } else if (input.jump && !g.ducking) {
      g.air = JUMP_TIME;
      g.events.push('jump');
    } else {
      if (!input.duck) {
        g.ducking = false;
        g.sliding = false;
      } else if (!g.ducking) {
        // Ducken aus der Bewegung wird zum Slide
        g.ducking = true;
        g.sliding = Math.hypot(g.vx, g.vy) >= s.speed * SLIDE_MIN;
        if (g.sliding) g.events.push('slide');
      }
      if (g.sliding) {
        // Rutscht geradeaus und wird gleichmäßig langsamer – die Strecke
        // wächst also mit dem Tempo beim Abducken.
        const speed = Math.hypot(g.vx, g.vy);
        const slower = speed - SLIDE_FRICTION * STEP;
        if (slower <= SLIDE_END) {
          g.sliding = false;
        } else {
          g.vx *= slower / speed;
          g.vy *= slower / speed;
        }
      }
      if (!g.sliding) steer(g, input, moveLen);
    }
    // Sprung und Slide laufen ungebremst; danach gilt wieder das tatsächliche Tempo
    if (g.air > 0 || g.sliding) g.speedLimit = Infinity;
    g.x += g.vx * STEP;
    g.y += g.vy * STEP;
  }
  // an der Wand bleibt nur die Bewegung entlang der Wand erhalten
  if (g.x !== clampTo(g.x, PLAYER_R)) g.vx = 0;
  if (g.y !== clampTo(g.y, PLAYER_R)) g.vy = 0;
  g.x = clampTo(g.x, PLAYER_R);
  g.y = clampTo(g.y, PLAYER_R);

  // Waffe wechseln und feuern; jede Waffe hat ihre eigene Abklingzeit
  if (input.swap && s.weapons.length > 1) g.weapon = (g.weapon + 1) % s.weapons.length;
  const id = s.weapons[g.weapon];
  const w = WEAPONS[id];
  if (input.fire && !g.dashing && g.weaponCooldown[g.weapon] <= 0) {
    g.weaponCooldown[g.weapon] = w.cooldown;
    g.events.push('shoot');
    // Streuung ist waffenabhängig; Ducken senkt sie
    const still = Math.hypot(g.vx, g.vy) < 20;
    const spread = w.spread * (g.ducking ? w.duckSpread : 1) * (still ? s.stillSpread : 1);
    const action = w.multi ? ++g.actionId : 0;
    const base = Math.atan2(g.aimY, g.aimX);
    for (let i = 0; i < w.pellets; i++) {
      const angle = base + (Math.random() * 2 - 1) * spread;
      const speed = w.speed * (w.pellets > 1 ? rand(0.85, 1) : 1);
      g.bullets.push({
        x: g.x + g.aimX * (PLAYER_R + 6),
        y: g.y + g.aimY * (PLAYER_R + 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: w.damage * s.weaponDamage[id],
        // Sprenggeschosse landen dort, wo das Fadenkreuz steht (höchstens in voller Reichweite)
        life: w.blast > 0 ? Math.min(w.life, Math.max(0.05, (aimLen - PLAYER_R - 6) / speed)) : w.life,
        pierce: w.pierce,
        blast: w.blast,
        action,
        hit: [],
      });
    }
  }

  // Kick: schleudert alle Gegner im Bogen vor der Figur in Zielrichtung weg.
  // Schwere Gegner fliegen entsprechend ihrer Masse langsamer.
  if (input.kick && !g.dashing && g.kickCooldown <= 0) {
    g.kickCooldown = s.kickCooldown;
    g.kickFlash = 0.12;
    g.events.push('kick');
    g.actionId++;
    for (const e of g.enemies) {
      const def = ENEMIES[e.kind];
      const dx = e.x - g.x;
      const dy = e.y - g.y;
      const dist = Math.hypot(dx, dy) || 1;
      const inArc = (dx / dist) * g.aimX + (dy / dist) * g.aimY >= Math.cos(KICK_ARC);
      if (!e.dead && dist < PLAYER_R + KICK_REACH + def.r && inArc) {
        damageEnemy(e, KICK_DAMAGE, 'kick', g.actionId);
        e.pushX = (g.aimX * s.kickForce) / def.mass;
        e.pushY = (g.aimY * s.kickForce) / def.mass;
        e.kicked = true;
      }
    }
  }
}

export function stepBullets(g: Game) {
  g.bullets = g.bullets.filter((b) => {
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
    b.life -= STEP;
    const detonate = () => {
      if (b.blast > 0) explode(g, b.x, b.y, b.blast, b.damage, GRENADE_PLAYER_DAMAGE, 'gun', b.action);
      return false;
    };
    if (b.life <= 0 || b.x < 0 || b.x > ARENA || b.y < 0 || b.y > ARENA) return detonate();

    for (const e of g.enemies) {
      if (e.dead || e.hp <= 0 || b.hit.includes(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) >= ENEMIES[e.kind].r + BULLET_R) continue;
      const speed = Math.hypot(b.vx, b.vy);
      // Der Schild-Mech blockt, was von vorn kommt
      const fromFront = -(b.vx / speed) * Math.cos(e.angle) - (b.vy / speed) * Math.sin(e.angle) > SHIELD_BLOCK;
      if (e.kind === 'shield' && fromFront && !e.kicked) {
        e.hitFlash = 0.05;
        return detonate();
      }
      if (b.blast > 0) return detonate();
      damageEnemy(e, b.damage, 'gun', b.action);
      g.events.push('hit');
      if (!e.kicked) {
        e.pushX = ((b.vx / speed) * 170) / ENEMIES[e.kind].mass;
        e.pushY = ((b.vy / speed) * 170) / ENEMIES[e.kind].mass;
      }
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
    return true;
  });
}

export { DASH_SPEED };
