// Die Figur: Zielen, Laufen, Springen/Ducken/Slide, Dash, Waffen, Kick.

import { STEP, ARENA } from './types.ts';
import type { Enemy, Game, Input } from './types.ts';
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
const SHIELD_BLOCK = Math.cos(1.2); // Schilddrohne blockt Schüsse aus ±70° von vorn
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
    // Adrenalin: jede Stufe der Serie macht etwas schneller
    const rush = 1 + g.stats.streakSpeed * Math.min(10, g.streak);
    const topSpeed = g.stats.speed * rush * (1 - (1 - BACKPEDAL) * (angle / Math.PI));
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
    // Schnellzieher: Der Dash macht Waffe (und ab Stufe 2 den Kick) sofort wieder bereit
    if (s.quickdraw >= 1) g.weaponCooldown.fill(0);
    if (s.quickdraw >= 2) g.kickCooldown = 0;
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
      // Doppelsprung: neuer Sprung aus der Luft, auf Wunsch in eine neue Richtung
      if (input.jump && g.airJumpsLeft > 0) {
        g.airJumpsLeft--;
        g.air = JUMP_TIME;
        g.events.push('jump');
        if (moveLen > 0) {
          const speed = Math.max(Math.hypot(g.vx, g.vy), s.speed * 0.8);
          g.vx = (input.moveX / moveLen) * speed;
          g.vy = (input.moveY / moveLen) * speed;
        }
      }
      if (g.air <= 0) g.airJumpsLeft = s.airJumps;
    } else if (input.jump && !g.ducking) {
      g.air = JUMP_TIME;
      g.airJumpsLeft = s.airJumps;
      g.events.push('jump');
    } else {
      if (!input.duck) {
        g.ducking = false;
        g.sliding = false;
      } else if (!g.ducking) {
        // Ducken aus der Bewegung wird zum Slide
        g.ducking = true;
        g.sliding = Math.hypot(g.vx, g.vy) >= s.speed * SLIDE_MIN;
        if (g.sliding) {
          g.events.push('slide');
          g.actionId++;
          for (const e of g.enemies) e.slideHit = false;
        }
      }
      if (g.sliding) {
        // Rutscht geradeaus und wird gleichmäßig langsamer – die Strecke
        // wächst also mit dem Tempo beim Abducken.
        const speed = Math.hypot(g.vx, g.vy);
        const slower = speed - SLIDE_FRICTION * s.slideFriction * STEP;
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
  if (input.fire && !g.dashing && g.weaponCooldown[g.weapon] <= 0 && w.beam) {
    // Strahlenwaffe: Die Abklingzeit läuft ab dem Drücken, der Strahl baut sich erst auf
    g.weaponCooldown[g.weapon] = w.cooldown;
    g.events.push('charge');
    g.playerBeam = {
      charge: w.beam.charge, chargeTime: w.beam.charge,
      fire: w.beam.duration, fireTime: w.beam.duration,
      width: w.beam.width,
      damage: w.damage * s.weaponDamage[id],
      action: ++g.actionId,
      length: 0,
      hit: [],
    };
  } else if (input.fire && !g.dashing && g.weaponCooldown[g.weapon] <= 0) {
    g.weaponCooldown[g.weapon] = w.cooldown;
    g.events.push('shoot');
    // Streuung ist waffenabhängig; Ducken senkt sie
    const still = Math.hypot(g.vx, g.vy) < 20;
    const spread = w.spread * s.spread * (g.ducking ? w.duckSpread : 1) * (still ? s.stillSpread : 1);
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
        damage: w.damage * s.weaponDamage[id] * (g.ducking ? w.duckDamage ?? 1 : 1),
        // Sprenggeschosse landen dort, wo das Fadenkreuz steht (höchstens in voller Reichweite)
        life: w.blast > 0 ? Math.min(w.life, Math.max(0.05, (aimLen - PLAYER_R - 6) / speed)) : w.life,
        maxLife: w.life,
        blast: w.blast,
        action,
        look: w.look ?? 'bullet',
        hitR: w.hitR ?? 0,
        pierce: w.pierce ?? false,
        hit: [],
        // Querschläger gilt für alles außer Flammen und Sprenggeschossen
        bounces: (w.bounces ?? 0) + (w.blast > 0 || w.look === 'flame' ? 0 : s.bounces),
        push: w.push ?? 0,
        chain: w.chain ?? 0,
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

const BEAM_PUSH = 260; // Rückstoß des Strahls

/** Abstand entlang des Strahls (along) und quer dazu (across) von der Figur aus. */
function beamCoords(g: Game, x: number, y: number) {
  const dx = x - g.x;
  const dy = y - g.y;
  return { along: dx * g.aimX + dy * g.aimY, across: Math.abs(dx * g.aimY - dy * g.aimX) };
}

/** Länge bis zum Rand der Arena in Zielrichtung. */
function lengthToWall(g: Game) {
  const tx = g.aimX > 0 ? (ARENA - g.x) / g.aimX : g.aimX < 0 ? -g.x / g.aimX : Infinity;
  const ty = g.aimY > 0 ? (ARENA - g.y) / g.aimY : g.aimY < 0 ? -g.y / g.aimY : Infinity;
  return Math.min(tx, ty);
}

/**
 * Schwerlaser: Während des Aufladens zeigt er nur, wohin er gleich brennt. Danach
 * trifft er ein paar Schritte lang alles auf der Linie – jeden Gegner einmal.
 * Eine Schilddrohne von vorn hält ihn auf.
 */
function stepPlayerBeam(g: Game) {
  const pb = g.playerBeam;
  if (!pb) return;
  pb.length = lengthToWall(g);
  // Die erste Schilddrohne, die in den Strahl schaut, begrenzt ihn
  for (const e of g.enemies) {
    if (e.kind !== 'shield' || e.dead || e.kicked) continue;
    const { along, across } = beamCoords(g, e.x, e.y);
    const facing = -g.aimX * Math.cos(e.angle) - g.aimY * Math.sin(e.angle) > SHIELD_BLOCK;
    if (facing && along > 0 && along < pb.length && across < ENEMIES.shield.r + pb.width) {
      pb.length = along - ENEMIES.shield.r;
      if (pb.fire > 0 && pb.charge <= 0) e.hitFlash = 0.05;
    }
  }

  if (pb.charge > 0) {
    pb.charge -= STEP;
    if (pb.charge <= 0) g.events.push('beam');
    return;
  }

  const inBeam = (x: number, y: number, r: number) => {
    const { along, across } = beamCoords(g, x, y);
    return along > -r && along < pb.length + r && across < r + pb.width;
  };
  for (const e of g.enemies) {
    if (e.dead || e.hp <= 0 || pb.hit.includes(e) || !inBeam(e.x, e.y, ENEMIES[e.kind].r)) continue;
    pb.hit.push(e);
    damageEnemy(e, pb.damage, 'gun', pb.action);
    g.events.push('hit');
    if (!e.kicked) {
      e.pushX = (g.aimX * BEAM_PUSH) / ENEMIES[e.kind].mass;
      e.pushY = (g.aimY * BEAM_PUSH) / ENEMIES[e.kind].mass;
    }
  }
  for (const t of g.turrets) {
    if (pb.hit.includes(t) || !inBeam(t.x, t.y, TURRET_R)) continue;
    pb.hit.push(t);
    t.hp -= pb.damage;
    t.hitFlash = 0.12;
  }
  for (const m of g.mines) {
    if (m.fuse === null && inBeam(m.x, m.y, MINE_R)) {
      m.fuse = 0;
      m.action = pb.action;
    }
  }
  for (const barrel of g.barrels) {
    if (barrel.fuse === null && inBeam(barrel.x, barrel.y, BARREL_R)) {
      barrel.fuse = 0;
      barrel.action = pb.action;
    }
  }

  pb.fire -= STEP;
  if (pb.fire <= 0) g.playerBeam = null;
}

const CHAIN_RANGE = 170;
const CHAIN_FALLOFF = 0.7; // jeder Sprung macht so viel vom vorigen Schaden

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
  stepPlayerBeam(g);
  g.bullets = g.bullets.filter((b) => {
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
    b.life -= STEP;
    const detonate = () => {
      if (b.blast > 0) explode(g, b.x, b.y, b.blast, b.damage, GRENADE_PLAYER_DAMAGE, 'gun', b.action, 'grenade');
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
      g.events.push('hit');
      if (b.push > 0) {
        // Impuls: schleudert wie ein Kick – Aufprall, Domino und Laser greifen danach wie gewohnt
        damageEnemy(e, b.damage, 'kick', b.action);
        e.pushX = ((b.vx / speed) * b.push) / ENEMIES[e.kind].mass;
        e.pushY = ((b.vy / speed) * b.push) / ENEMIES[e.kind].mass;
        e.kicked = true;
      } else {
        damageEnemy(e, b.damage, 'gun', b.action);
        if (!e.kicked && b.look !== 'flame') {
          e.pushX = ((b.vx / speed) * 170) / ENEMIES[e.kind].mass;
          e.pushY = ((b.vy / speed) * 170) / ENEMIES[e.kind].mass;
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
