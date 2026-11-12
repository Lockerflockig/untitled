// Platzhalter-Darstellung. Art, Stil und Animationen kommen, wenn die Mechaniken stehen.
//
// Farbcode für Höhen: niedrig = orange (springen), hoch = blau (ducken), voll = magenta (dashen).

import { ARENA } from './sim/types.ts';
import type { Enemy, Game, Height } from './sim/types.ts';
import {
  BANANA_R, BARREL_R, BLAST_TIME, ENEMIES, MINE_R, PLAYER_R as BASE_R, TURRET_R, jumpHeight,
} from './sim/core.ts';
import { BULLET_R, KICK_ARC, KICK_REACH } from './sim/player.ts';
import { BOMB_FUSE, GUNNER_WINDUP, SPAWN_WARN } from './sim/enemies.ts';
import { BEAM_LOCK, FIELD_WARN, LASER_WARN, SHOT_R, TURRET_HP } from './sim/hazards.ts';
import { ENTRY_X, EXIT_HALF, EXIT_Y, RUN_OUT_TIME, SLIDE_TIME } from './sim/game.ts';
import {
  drawEnemySprite, drawExplosionSprite, drawPlayerSprite, enemySpriteReady, spritesReady,
} from './sprites.ts';

// Der Raum ist von Wänden umgeben, die wie im Original nach außen "hochklappen":
// die Innenkante ist der Boden, die Außenkante die Wandoberkante.
export const WALL = 60;
export const VIEW = ARENA + 2 * WALL; // Kantenlänge des gezeichneten Ausschnitts

const HEIGHT_COLOR: Record<Height, string> = { low: '#ffb347', high: '#4da3ff', full: '#ff4fd8' };
const HEIGHT_LABEL: Record<Height, string> = { low: 'NIEDRIG · springen', high: 'HOCH · ducken', full: 'VOLL · dashen' };
const ENEMY_COLOR = { hunter: '#ff5d73', gunner: '#ff9f43', shield: '#b388ff', bomber: '#ffe066', heavy: '#c0392b', boss: '#2ecc71' };

type Ctx = CanvasRenderingContext2D;
type Side = 'top' | 'bottom' | 'left' | 'right';
const ease = (t: number) => t * t * (3 - 2 * t);

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

/** Punkt auf einer Wand: pos entlang der Wand (Raum-Koordinate), t = Höhe 0 (Boden) bis 1 (Oberkante). */
function wallPoint(side: Side, pos: number, t: number): [number, number] {
  const along = -WALL * t + (pos / ARENA) * (ARENA + 2 * WALL * t);
  switch (side) {
    case 'top': return [along, -WALL * t];
    case 'bottom': return [along, ARENA + WALL * t];
    case 'left': return [-WALL * t, along];
    case 'right': return [ARENA + WALL * t, along];
  }
}

function wallQuad(ctx: Ctx, side: Side, from: number, to: number, t0 = 0, t1 = 1) {
  ctx.beginPath();
  ctx.moveTo(...wallPoint(side, from, t0));
  ctx.lineTo(...wallPoint(side, to, t0));
  ctx.lineTo(...wallPoint(side, to, t1));
  ctx.lineTo(...wallPoint(side, from, t1));
  ctx.closePath();
}

/** Farbton eines Raums: Raum 1 ist rot wie im Original, danach wandert er weiter. */
const roomHue = (room: number) => ((room - 1) * 47) % 360;

/**
 * Boden. Die Grundfläche ist immer ein Verlauf von hell (oben links) nach dunkel
 * (unten rechts) wie im Original; das Muster darauf wechselt von Raum zu Raum.
 */
function drawFloor(ctx: Ctx, room: number, hue: number) {
  const gradient = ctx.createLinearGradient(0, 0, ARENA, ARENA);
  gradient.addColorStop(0, `hsl(${hue} 70% 30%)`);
  gradient.addColorStop(1, `hsl(${hue} 80% 5%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA, ARENA);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ARENA, ARENA);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  switch ((room - 1) % 4) {
    case 0: // Raster wie im Original
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let p = 50; p < ARENA; p += 50) {
        ctx.moveTo(p, 0);
        ctx.lineTo(p, ARENA);
        ctx.moveTo(0, p);
        ctx.lineTo(ARENA, p);
      }
      ctx.stroke();
      break;
    case 1: // große Bodenplatten mit Schrauben in den Ecken
      ctx.lineWidth = 2;
      for (let x = 0; x < ARENA; x += 200) {
        for (let y = 0; y < ARENA; y += 200) {
          ctx.strokeRect(x + 3, y + 3, 194, 194);
          for (const [bx, by] of [[14, 14], [186, 14], [14, 186], [186, 186]]) {
            ctx.fillRect(x + bx - 3, y + by - 3, 6, 6);
          }
        }
      }
      break;
    case 2: // Arena-Markierung: Ringe und Achsen
      ctx.lineWidth = 3;
      for (const r of [120, 260, 380]) {
        circle(ctx, ARENA / 2, ARENA / 2, r);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(ARENA / 2, 0);
      ctx.lineTo(ARENA / 2, ARENA);
      ctx.moveTo(0, ARENA / 2);
      ctx.lineTo(ARENA, ARENA / 2);
      ctx.stroke();
      break;
    case 3: // schräge Bahnen
      ctx.lineWidth = 26;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      for (let p = -ARENA; p < ARENA; p += 110) {
        ctx.moveTo(p, 0);
        ctx.lineTo(p + ARENA, ARENA);
      }
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Wände, Boden und Raumnummer. doors: offene Durchgänge links (Eingang) und rechts (Ausgang). */
function drawRoom(ctx: Ctx, room: number, doors: { entry: boolean; exit: boolean }) {
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(-WALL, -WALL, VIEW, VIEW);
  const hue = roomHue(room);
  // Wände aus Metallpaneelen: je Seite unterschiedlich hell, damit sie räumlich wirken
  const light: Record<Side, number> = { top: 30, left: 25, right: 19, bottom: 15 };
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    wallQuad(ctx, side, 0, ARENA);
    ctx.fillStyle = `hsl(${hue} 12% ${light[side]}%)`;
    ctx.fill();
    // Paneelfugen quer zur Wand
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    for (let pos = 0; pos <= ARENA; pos += 100) {
      ctx.beginPath();
      ctx.moveTo(...wallPoint(side, pos, 0));
      ctx.lineTo(...wallPoint(side, pos, 1));
      ctx.stroke();
    }
    // Zwei Fugen teilen die Wand in drei Bänder: unten, Mitte, oben
    for (const t of [1 / 3, 2 / 3, 1]) {
      ctx.beginPath();
      ctx.moveTo(...wallPoint(side, 0, t));
      ctx.lineTo(...wallPoint(side, ARENA, t));
      ctx.stroke();
    }
    // Leuchtband im mittleren Band, unterbrochen an jeder Paneelfuge
    ctx.strokeStyle = `hsl(${hue} 90% 62%)`;
    ctx.lineWidth = 2.5;
    for (let pos = 0; pos < ARENA; pos += 100) {
      ctx.beginPath();
      ctx.moveTo(...wallPoint(side, pos + 14, 0.5));
      ctx.lineTo(...wallPoint(side, pos + 86, 0.5));
      ctx.stroke();
    }
  }
  for (const [side, open] of [['left', doors.entry], ['right', doors.exit]] as [Side, boolean][]) {
    if (!open) continue;
    wallQuad(ctx, side, EXIT_Y - EXIT_HALF, EXIT_Y + EXIT_HALF);
    ctx.fillStyle = '#05060a';
    ctx.fill();
    ctx.strokeStyle = side === 'right' ? '#ffd166' : '#56607a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  drawFloor(ctx, room, hue);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.font = '700 420px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(room), ARENA / 2, ARENA / 2 + 20);
  if (doors.exit) {
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.fillText('➜', ARENA - 40, EXIT_Y);
  }
}

/** Austritt eines Lasers an beiden Wänden: unten, oben oder über die ganze Wandhöhe. */
const EMITTER_SPAN: Record<Height, [number, number]> = { low: [0, 1 / 3], high: [2 / 3, 1], full: [0, 1] };

function drawLasers(ctx: Ctx, g: Game) {
  for (const l of g.lasers) {
    const warning = l.warn > 0;
    const color = HEIGHT_COLOR[l.height];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (warning) {
      ctx.globalAlpha = 0.35 + 0.5 * (1 - l.warn / LASER_WARN);
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 2;
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 4;
    }
    ctx.beginPath();
    if (l.vertical) {
      ctx.moveTo(l.pos, 0);
      ctx.lineTo(l.pos, ARENA);
    } else {
      ctx.moveTo(0, l.pos);
      ctx.lineTo(ARENA, l.pos);
    }
    ctx.stroke();
    // Austritt an den Wänden
    const [from, to] = EMITTER_SPAN[l.height];
    ctx.setLineDash([]);
    ctx.lineWidth = 9;
    for (const side of (l.vertical ? ['top', 'bottom'] : ['left', 'right']) as Side[]) {
      ctx.beginPath();
      ctx.moveTo(...wallPoint(side, l.pos, from));
      ctx.lineTo(...wallPoint(side, l.pos, to));
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    if (l.vertical) {
      ctx.textAlign = l.pos > ARENA - 150 ? 'right' : 'left';
      ctx.fillText(HEIGHT_LABEL[l.height], l.pos + (l.pos > ARENA - 150 ? -8 : 8), 10);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(HEIGHT_LABEL[l.height], 10, l.pos + (l.pos > ARENA - 30 ? -20 : 6));
    }
    ctx.restore();
  }
}

function drawHazards(ctx: Ctx, g: Game, time: number) {
  // Bodenfelder (niedrig)
  for (const f of g.fields) {
    const warning = f.warn > 0;
    circle(ctx, f.x, f.y, f.r);
    ctx.fillStyle = warning ? `rgba(255, 179, 71, ${0.08 + 0.22 * (1 - f.warn / FIELD_WARN)})` : 'rgba(255, 179, 71, 0.75)';
    ctx.fill();
    ctx.strokeStyle = HEIGHT_COLOR.low;
    ctx.lineWidth = 2;
    ctx.setLineDash(warning ? [8, 8] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (warning) {
      // schrumpfender Ring zeigt, wann es auslöst
      circle(ctx, f.x, f.y, f.r * (f.warn / FIELD_WARN));
      ctx.stroke();
    }
  }

  // Minen (niedrig)
  for (const m of g.mines) {
    const lit = m.fuse !== null;
    circle(ctx, m.x, m.y, MINE_R);
    ctx.fillStyle = '#2a2f3b';
    ctx.fill();
    ctx.strokeStyle = HEIGHT_COLOR.low;
    ctx.lineWidth = 2;
    ctx.stroke();
    circle(ctx, m.x, m.y, 4);
    ctx.fillStyle = lit && Math.floor(time * 16) % 2 ? '#ffffff' : '#ff5d73';
    ctx.fill();
  }

  // Fässer (voll)
  for (const b of g.barrels) {
    circle(ctx, b.x, b.y, BARREL_R);
    ctx.fillStyle = b.fuse !== null ? '#ffffff' : '#8a4b1f';
    ctx.fill();
    ctx.strokeStyle = HEIGHT_COLOR.full;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', b.x, b.y + 1);
  }

  // Geschütze
  for (const t of g.turrets) {
    const dist = Math.hypot(g.x - t.x, g.y - t.y) || 1;
    ctx.fillStyle = t.hitFlash > 0 ? '#ffffff' : '#7c8499';
    ctx.fillRect(t.x - TURRET_R, t.y - TURRET_R, TURRET_R * 2, TURRET_R * 2);
    ctx.strokeStyle = '#1b1f29';
    ctx.lineWidth = 2;
    ctx.strokeRect(t.x - TURRET_R, t.y - TURRET_R, TURRET_R * 2, TURRET_R * 2);
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + ((g.x - t.x) / dist) * 24, t.y + ((g.y - t.y) / dist) * 24);
    ctx.strokeStyle = HEIGHT_COLOR.high;
    ctx.lineWidth = 6;
    ctx.stroke();
    if (t.hp < TURRET_HP) {
      ctx.fillStyle = '#3a1820';
      ctx.fillRect(t.x - TURRET_R, t.y - TURRET_R - 9, TURRET_R * 2, 4);
      ctx.fillStyle = '#ff5d73';
      ctx.fillRect(t.x - TURRET_R, t.y - TURRET_R - 9, TURRET_R * 2 * Math.max(0, t.hp / TURRET_HP), 4);
    }
  }

  // Zielstrahl (hoch)
  for (const b of g.beams) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(b.ox, b.oy);
    ctx.lineTo(b.ox + b.dx * 1600, b.oy + b.dy * 1600);
    ctx.strokeStyle = HEIGHT_COLOR.high;
    if (b.phase === 'track') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
    } else if (b.phase === 'lock') {
      ctx.globalAlpha = 0.5 + 0.5 * (1 - b.t / BEAM_LOCK);
      ctx.lineWidth = 3;
    } else {
      ctx.shadowColor = HEIGHT_COLOR.high;
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#e6f2ff';
      ctx.lineWidth = 12;
    }
    ctx.stroke();
    ctx.restore();
    circle(ctx, b.ox, b.oy, 10);
    ctx.fillStyle = HEIGHT_COLOR.high;
    ctx.fill();
  }

  // Gegnerische Geschosse (hoch)
  ctx.fillStyle = HEIGHT_COLOR.high;
  for (const s of g.shots) {
    circle(ctx, s.x, s.y, SHOT_R);
    ctx.fill();
  }
}

function drawEnemy(ctx: Ctx, g: Game, e: Enemy, time: number) {
  const def = ENEMIES[e.kind];
  if (enemySpriteReady(e.kind)) {
    drawEnemySprite(ctx, g, e, time);
    return;
  }
  // Ersatz, solange die Bilder noch laden
  if (e.dead) {
    // Wrack: grau, verblasst mit dem Schwung
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.hypot(e.pushX, e.pushY) / 400);
    circle(ctx, e.x, e.y, def.r);
    ctx.fillStyle = '#4a4f5e';
    ctx.fill();
    ctx.strokeStyle = ENEMY_COLOR[e.kind];
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const dist = Math.hypot(g.x - e.x, g.y - e.y) || 1;
  const toX = (g.x - e.x) / dist;
  const toY = (g.y - e.y) / dist;
  const fusing = e.fuse !== null;

  if (fusing) {
    // Sprengradius der Sprengdrohne
    circle(ctx, e.x, e.y, 80 * (1 - (e.fuse ?? 0) / BOMB_FUSE));
    ctx.strokeStyle = HEIGHT_COLOR.full;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  circle(ctx, e.x, e.y, def.r);
  ctx.fillStyle = e.hitFlash > 0 || (fusing && Math.floor(time * 16) % 2) ? '#ffffff' : ENEMY_COLOR[e.kind];
  ctx.globalAlpha = e.kicked ? 0.7 : 1;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#1b1f29';
  ctx.lineWidth = e.kind === 'heavy' ? 5 : 2;
  ctx.stroke();

  if (e.kind === 'gunner') {
    // Lauf zeigt zur Figur; leuchtet beim Zielen auf
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + toX * (def.r + 8), e.y + toY * (def.r + 8));
    ctx.strokeStyle = e.windup > 0 ? '#ffffff' : '#1b1f29';
    ctx.lineWidth = 5;
    ctx.stroke();
    if (e.windup > 0) {
      circle(ctx, e.x, e.y, def.r + 10 * (e.windup / GUNNER_WINDUP));
      ctx.strokeStyle = HEIGHT_COLOR.high;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (e.kind === 'shield') {
    // Schild: blockt Schüsse von vorn
    ctx.beginPath();
    ctx.arc(e.x, e.y, def.r + 5, e.angle - 1.2, e.angle + 1.2);
    ctx.strokeStyle = '#e6dcff';
    ctx.lineWidth = 5;
    ctx.stroke();
  } else {
    // "Auge" schaut zur Figur
    circle(ctx, e.x + toX * def.r * 0.45, e.y + toY * def.r * 0.45, def.r * 0.28);
    ctx.fillStyle = '#10131a';
    ctx.fill();
  }
  if (e.hp < def.hp) {
    ctx.fillStyle = '#3a1820';
    ctx.fillRect(e.x - def.r, e.y - def.r - 9, def.r * 2, 4);
    ctx.fillStyle = ENEMY_COLOR[e.kind];
    ctx.fillRect(e.x - def.r, e.y - def.r - 9, def.r * 2 * Math.max(0, e.hp / def.hp), 4);
  }
}

function drawBanana(ctx: Ctx, x: number, y: number, time: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 3 + x) * 2);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.arc(0, -6, BANANA_R, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.arc(0, -13, BANANA_R + 2, 0.8 * Math.PI, 0.2 * Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx: Ctx, g: Game, x: number, groundY: number, time: number) {
  const height = jumpHeight(g);
  // Platzhalter für die Ebenen: geduckt kleiner, im Sprung größer und über einem Schatten
  const r = BASE_R * (g.ducking ? 0.72 : 1 + 0.25 * height);
  const y = groundY - height * 34;
  ctx.save();
  if (g.stats.pickup > 0 && g.plan.objective === 'collect' && g.phase === 'play') {
    circle(ctx, x, groundY, BASE_R + BANANA_R + g.stats.pickup);
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (spritesReady()) {
    drawPlayerSprite(ctx, g, x, groundY, time);
    ctx.restore();
    return;
  }
  // Ersatz, solange die Bilder noch laden
  if (height > 0) {
    ctx.beginPath();
    ctx.ellipse(x, groundY + 4, BASE_R * (1 - 0.3 * height), BASE_R * 0.5 * (1 - 0.3 * height), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
  }
  if (g.sliding) {
    // Rutsch-Spur
    const speed = Math.hypot(g.vx, g.vy) || 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (g.vx / speed) * 46, y - (g.vy / speed) * 46);
    ctx.strokeStyle = 'rgba(95, 209, 198, 0.35)';
    ctx.lineWidth = r * 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  if (g.dashing) {
    for (let i = 1; i <= 3; i++) {
      circle(ctx, x - g.dashX * i * 26, y - g.dashY * i * 26, r * (1 - i * 0.12));
      ctx.fillStyle = `rgba(255, 255, 255, ${0.22 - i * 0.05})`;
      ctx.fill();
    }
  }
  if (g.shield > 0) ctx.globalAlpha = Math.floor(time * 12) % 2 ? 0.3 : 0.85;

  // Lauf der Waffe zeigt die Zielrichtung
  ctx.beginPath();
  ctx.moveTo(x + g.aimX * r * 0.6, y + g.aimY * r * 0.6);
  ctx.lineTo(x + g.aimX * (r + 10), y + g.aimY * (r + 10));
  ctx.strokeStyle = '#e8eaf0';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();

  circle(ctx, x, y, r);
  ctx.fillStyle = g.invuln > 0 ? 'rgba(255, 255, 255, 0.4)' : '#5fd1c6';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = g.invuln > 0 ? '#ffffff' : '#b6f3ec';
  ctx.stroke();
  ctx.restore();
}

function drawScene(ctx: Ctx, g: Game, alpha: number, time: number) {
  drawRoom(ctx, g.room, { entry: g.room > 1, exit: g.phase !== 'play' });
  for (const b of g.bananas) drawBanana(ctx, b.x, b.y, time);
  drawLasers(ctx, g);
  drawHazards(ctx, g, time);

  // Ankündigung: hier erscheint gleich ein Gegner
  for (const s of g.spawns) {
    const p = 1 - s.t / SPAWN_WARN;
    circle(ctx, s.x, s.y, ENEMIES[s.kind].r + (1 - p) * 30);
    ctx.strokeStyle = ENEMY_COLOR[s.kind];
    ctx.globalAlpha = 0.3 + 0.7 * p;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  // Weiter hinten stehende zuerst, damit sich die Figuren richtig überdecken
  for (const e of [...g.enemies].sort((a, b) => a.y - b.y)) drawEnemy(ctx, g, e, time);

  for (const b of g.bullets) {
    circle(ctx, b.x, b.y, b.blast > 0 ? 7 : b.pierce ? 5 : BULLET_R);
    ctx.fillStyle = b.blast > 0 ? '#ff9f43' : b.pierce ? '#9be7ff' : '#fff3c4';
    ctx.fill();
  }

  // Explosionen: Der Ring zeigt kurz den Wirkradius, darüber läuft die Sprite-Animation
  for (const b of g.blasts) {
    const p = 1 - b.t / BLAST_TIME;
    if (p < 0.5) {
      circle(ctx, b.x, b.y, b.r * (0.5 + p));
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - 2 * p})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (!drawExplosionSprite(ctx, b.x, b.y, b.r, p)) {
      circle(ctx, b.x, b.y, b.r * (0.4 + 0.6 * p));
      ctx.fillStyle = `rgba(255, 159, 67, ${0.5 * (1 - p)})`;
      ctx.fill();
    }
  }

  if (g.phase !== 'transition') {
    const px = g.prevX + (g.x - g.prevX) * alpha;
    const py = g.prevY + (g.y - g.prevY) * alpha;
    if (g.kickFlash > 0) {
      // Kick-Bogen: zeigt Reichweite und Winkel
      const aim = Math.atan2(g.aimY, g.aimX);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, BASE_R + KICK_REACH, aim - KICK_ARC, aim + KICK_ARC);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${g.kickFlash * 3})`;
      ctx.fill();
    }
    drawPlayer(ctx, g, px, py, time);
  }

  // Punkte steigen an der Stelle auf, an der sie verdient wurden
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of g.popups) {
    ctx.fillStyle = `rgba(255, 209, 102, ${Math.min(1, p.t * 2.5)})`;
    ctx.fillText(p.text, p.x, p.y - 20 - (0.9 - p.t) * 40);
  }

  if (g.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 60, 80, ${g.hitFlash * 1.6})`;
    ctx.fillRect(0, 0, ARENA, ARENA);
  }
}

/**
 * @param alpha Anteil des angefangenen Simulationsschritts (0..1), zum Glätten der Spielerbewegung
 * @param time  laufende Zeit in Sekunden, nur für Animationen
 */
export function draw(ctx: Ctx, g: Game, alpha: number, pixels: number, time: number) {
  const scale = pixels / VIEW;
  ctx.setTransform(scale, 0, 0, scale, WALL * scale, WALL * scale);
  ctx.imageSmoothingEnabled = false; // Pixel-Art bleibt kantig

  if (g.phase !== 'transition') {
    drawScene(ctx, g, alpha, time);
    return;
  }

  // Raumwechsel: erst rennt die Figur durch den Ausgang, dann fährt die Kamera
  // in den nächsten Raum, wo sie durch den Eingang hereinkommt.
  const t = g.transition;
  if (t < RUN_OUT_TIME) {
    const p = ease(t / RUN_OUT_TIME);
    drawScene(ctx, g, alpha, time);
    drawPlayer(ctx, g, g.exitFromX + (ARENA + WALL + BASE_R - g.exitFromX) * p, g.exitFromY, time);
    return;
  }
  const p = ease(Math.min(1, (t - RUN_OUT_TIME) / SLIDE_TIME));
  ctx.save();
  ctx.translate(-p * VIEW, 0);
  drawScene(ctx, g, alpha, time);
  ctx.translate(VIEW, 0);
  drawRoom(ctx, g.room + 1, { entry: true, exit: false });
  drawPlayer(ctx, g, -WALL - BASE_R + (ENTRY_X + WALL + BASE_R) * p, g.exitFromY + (EXIT_Y - g.exitFromY) * p, time);
  ctx.restore();
}
