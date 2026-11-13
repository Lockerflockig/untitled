// Ablauf eines Runs: Räume mit Aufgaben, Ausgang, Raumwechsel, Leben.

import { ARENA, STEP } from './types.ts';
import type { Game, Input, ObjectiveType, RoomPlan, Stats, EnemyKind } from './types.ts';
import { BANANA_R, BLAST_TIME, ENEMIES, PLAYER_R, award, explode, rand, spot } from './core.ts';
import { stepPlayer, stepPlayerBeam } from './player.ts';
import { stepBullets } from './projectiles.ts';
import { BOSS_FIRST, RANGED_ORDER, makeEnemy, stepEnemies, stepSpawns, unlockedRanged } from './enemies.ts';
import { TURRET_HP, stepHazards } from './hazards.ts';
import { rollOffers, stepPickups } from './loot.ts';

export const RUN_OUT_TIME = 0.5; // Raumwechsel: Figur rennt hinaus
export const SLIDE_TIME = 0.7; // Raumwechsel: Kamera fährt in den nächsten Raum
export const EXIT_Y = ARENA / 2; // Ausgang in der Mitte der rechten Wand
export const EXIT_HALF = 60; // halbe Breite des Ausgangs
export const ENTRY_X = 50;

const BANANAS_ON_FIELD = 3;
const POINTS_BANANA = 50;
const POINTS_ROOM = 500;
const NO_HIT_BONUS = 1.5; // Faktor auf den Raum-Bonus, wenn man nicht getroffen wurde
const REVIVE_SHIELD = 2;
const BOSS_EVERY = 5;

// --- Was mit dem Level steigt ----------------------------------------------------
// Level ist die Raumnummer. Leben, Tempo und Schaden jedes Gegners wachsen in
// core.ts (enemyStats). Hier steht der Rest an einer Stelle: welche Typen
// erscheinen, wie viele gleichzeitig im Raum sind und wie schnell sie nachkommen.
// Die Mengen und das Verhältnis von Nah- zu Fernkämpfern werden später eigens überarbeitet.

/** Gegnertypen, die im Raum erscheinen: ab welchem Level sie dazukommen und mit welchem Gewicht sie gewürfelt werden. */
const SPAWN_MIX: { kind: EnemyKind; from: number; weight: number }[] = [
  { kind: 'hunter', from: 1, weight: 6 },
  { kind: 'gunner', from: 3, weight: 2 },
  { kind: 'bomber', from: 4, weight: 2 },
  { kind: 'shield', from: 6, weight: 2 },
  { kind: 'heavy', from: 7, weight: 1 },
];
const MAX_ENEMIES = { base: 5, perLevel: 1, cap: 14 }; // gleichzeitig im Raum: 5 + Level, höchstens 14
const SPAWN_EVERY = { start: 2.4, perLevel: 0.15, min: 0.9 }; // s zwischen zwei neuen Gegnern: sinkt mit dem Level
const BOSS_ROOM = { maxEnemies: 3, spawnEvery: 4 }; // im Boss-Raum kommen nur wenige Begleiter

// --- Testmodus ---------------------------------------------------------------------
// Zum Ausprobieren, nicht für das eigentliche Spiel (im Browser: ?test an der
// Adresse). Die Raumfolge zeigt alles nacheinander:
//   Raum 1–3   der Boss in seinen drei Stufen (als Boss aus Level 5, 10 und 15)
//   Raum 4–8   je Raum ein Gegnertyp mehr, der neue kommt am häufigsten
//   Raum 9–18  nur Fernkämpfer, je Raum eine Waffen-Klasse mehr (Raum 9: Pistole, Raum 10
//              dazu Schwerlaser …), die neue Klasse kommt am häufigsten
//   danach     die normale Raumfolge
// Diese Räume haben „Säubern" mit kleinem Ziel und außer Lasern keine Gefahren,
// damit man die Gegner in Ruhe ansehen kann.

export const testMode = { on: false };
const TEST_BOSS_ROOMS = 3;
const TEST_CLEAR_GOAL = 6;

/** Level des Bosses in einem Raum: im Testmodus stehen die drei Stufen in Raum 1–3. */
export const bossLevelIn = (room: number) => (testMode.on && room <= TEST_BOSS_ROOMS ? room * BOSS_EVERY : room);

function testPlan(n: number): RoomPlan | null {
  const quiet = { beamEvery: null, fieldEvery: null, mines: 0, turrets: 0, multiplier: 1 + 0.25 * (n - 1) };
  const lasers = { laserEvery: [3.5, 5.5] as [number, number], maxLasers: 2 };
  if (n <= TEST_BOSS_ROOMS) {
    return {
      objective: 'boss', goal: 1, mix: [['hunter', 1]], gunners: [['pistol', 1]],
      maxEnemies: BOSS_ROOM.maxEnemies, spawnEvery: BOSS_ROOM.spawnEvery,
      ...lasers, ...quiet, barrels: 2,
    };
  }
  const kinds = n - TEST_BOSS_ROOMS;
  const classes = kinds - SPAWN_MIX.length; // Waffen-Klassen der Fernkämpfer in diesem Raum
  if (classes > RANGED_ORDER.length) return null;
  // was in diesem Raum neu ist, wird dreimal so oft gewürfelt wie die übrigen
  const weighted = <T,>(items: T[]): [T, number][] => items.map((item, i): [T, number] => [item, i === items.length - 1 ? 6 : 2]);
  return {
    objective: 'clear', goal: TEST_CLEAR_GOAL,
    mix: classes > 0
      ? [['gunner', 1]]
      : weighted(SPAWN_MIX.slice(0, kinds).map((m) => m.kind)),
    gunners: classes > 0 ? weighted(RANGED_ORDER.slice(0, classes)) : [['pistol', 1]],
    maxEnemies: 5, spawnEvery: 1.6,
    ...lasers, ...quiet, barrels: 0,
  };
}

/**
 * Was ein Raum enthält. Neue Gegner und Gefahren kommen einzeln dazu; ab Raum 8
 * wechseln die Aufgaben reihum und alles wird dichter.
 */
export function roomPlan(n: number): RoomPlan {
  const test = testMode.on ? testPlan(n) : null;
  if (test) return test;
  const intro: ObjectiveType[] = ['collect', 'clear', 'collect', 'survive', 'boss', 'destroy', 'clear', 'collect'];
  const cycle: ObjectiveType[] = ['clear', 'survive', 'destroy', 'collect'];
  // Jeder fünfte Raum ist ein Boss-Raum
  const objective = n % BOSS_EVERY === 0 ? 'boss' : n <= intro.length ? intro[n - 1] : cycle[n % cycle.length];
  const boss = objective === 'boss';

  const mix = SPAWN_MIX.filter((m) => n >= m.from).map((m): [EnemyKind, number] => [m.kind, m.weight]);

  const goal = {
    collect: 10 + 2 * Math.floor(n / 3),
    clear: 6 + 2 * n,
    survive: 30 + 5 * Math.min(n, 6),
    destroy: Math.min(5, 2 + Math.floor(n / 3)),
    boss: 1,
  }[objective];

  const pace = Math.max(0.6, 1 - 0.04 * n);
  return {
    objective,
    goal,
    mix,
    gunners: unlockedRanged(n),
    // Im Boss-Raum kommen nur wenige Begleiter; der Boss legt seine Bodenfelder selbst
    maxEnemies: boss ? BOSS_ROOM.maxEnemies : Math.min(MAX_ENEMIES.cap, MAX_ENEMIES.base + MAX_ENEMIES.perLevel * n),
    spawnEvery: boss ? BOSS_ROOM.spawnEvery : Math.max(SPAWN_EVERY.min, SPAWN_EVERY.start - SPAWN_EVERY.perLevel * n),
    laserEvery: [3.5 * pace, 5.5 * pace],
    maxLasers: Math.min(4, 2 + Math.floor(n / 4)),
    beamEvery: n >= 7 && !boss ? Math.max(3, 8 - 0.3 * n) : null,
    fieldEvery: n >= 3 && !boss ? Math.max(2.5, 6 - 0.3 * n) : null,
    mines: n >= 4 && !boss ? 3 + Math.floor(n / 3) : 0,
    barrels: n >= 2 ? 2 + (n % 3) : 0,
    turrets: objective === 'destroy' ? goal : n >= 8 ? 1 : 0,
    multiplier: 1 + 0.25 * (n - 1),
  };
}

/** Punkt an der Wand für ein Geschütz – nicht vor Eingang oder Ausgang. */
function turretSpot(): { x: number; y: number } {
  const inset = 26;
  const along = rand(90, ARENA - 90);
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: along, y: inset };
  if (side === 1) return { x: along, y: ARENA - inset };
  const clear = Math.abs(along - EXIT_Y) < EXIT_HALF + 40 ? along + (along < EXIT_Y ? -110 : 110) : along;
  return side === 2 ? { x: inset, y: clear } : { x: ARENA - inset, y: clear };
}

function clearRoom(g: Game) {
  g.bullets = [];
  g.playerBeam = null;
  g.enemies = [];
  g.spawns = [];
  g.lasers = [];
  g.beams = [];
  g.fields = [];
  g.mines = [];
  g.barrels = [];
  g.turrets = [];
  g.pylon = null; // Mast und Schwarm verschwinden mit dem Raum
  g.bananas = [];
}

function enterRoom(g: Game, n: number) {
  g.room = n;
  g.plan = roomPlan(n);
  g.phase = 'play';
  g.transition = 0;
  g.progress = 0;
  g.roomHit = false;
  g.roomKills = 0;
  clearRoom(g);
  g.marks = []; // Spuren überstehen das Ende der Aufgabe (clearRoom), nicht den Raumwechsel
  g.pickups = [];
  g.arcs = [];
  g.guard = g.stats.guard; // der Schildgenerator lädt in jedem Raum neu
  g.spawnTimer = 1.5;
  g.laserTimer = 4;
  g.beamTimer = 5;
  g.fieldTimer = 3;
  for (let i = 0; i < g.plan.mines; i++) g.mines.push({ ...spot(g, 70, 140), fuse: null, action: 0 });
  for (let i = 0; i < g.plan.barrels; i++) g.barrels.push({ ...spot(g, 90, 160), fuse: null, action: 0 });
  for (let i = 0; i < g.plan.turrets; i++) {
    g.turrets.push({ ...turretSpot(), hp: TURRET_HP, cooldown: 1.5 + i * 0.5, hitFlash: 0, dashHit: false });
  }
  if (g.plan.objective === 'collect') {
    for (let i = 0; i < BANANAS_ON_FIELD; i++) g.bananas.push(spot(g, 50, 150));
  }
  if (g.plan.objective === 'boss') {
    // Der Boss skaliert wie alle über sein Level (die Raumnummer): Level 5 hat 900 Trefferpunkte
    const boss = makeEnemy('boss', ARENA - 160, ARENA / 2, bossLevelIn(n));
    boss.boss!.t = BOSS_FIRST;
    g.enemies.push(boss);
  }
}

export function newGame(stats: Stats, startRoom = 1): Game {
  const g: Game = {
    stats, baseStats: stats,
    found: null, weaponLevels: { [stats.weapons[0]]: 1 }, modules: [], offers: [], pickups: [],
    guard: 0, airJumpsLeft: 0, arcs: [],
    room: 1, plan: roomPlan(1), phase: 'play', transition: 0, exitFromX: 0, exitFromY: 0,
    progress: 0, roomHit: false,
    x: ARENA / 2, y: ARENA / 2, prevX: ARENA / 2, prevY: ARENA / 2,
    vx: 0, vy: 0, speedLimit: Infinity,
    air: 0, ducking: false, sliding: false,
    aimX: 1, aimY: 0,
    hp: stats.maxHp, lives: stats.extraLives, shield: 0, hitFlash: 0,
    dashes: stats.dashCharges, dashRecharge: 0, dashTime: 0, dashing: false, dashX: 1, dashY: 0, invuln: 0,
    kickCooldown: 0, kickFlash: 0,
    weapon: 0, weaponCooldown: stats.weapons.map(() => 0),
    bullets: [], playerBeam: null, enemies: [], spawns: [], spawnTimer: 0,
    lasers: [], laserTimer: 0, beams: [], beamTimer: 0, fields: [], fieldTimer: 0,
    mines: [], barrels: [], turrets: [], pylon: null, blasts: [], marks: [], bananas: [],
    score: 0, streak: 0, streakTimer: 0, actionId: 0, comboAction: 0, comboKills: 0,
    popups: [], kills: 0, roomKills: 0, time: 0, over: false, events: [],
  };
  enterRoom(g, startRoom);
  return g;
}

/** Aufgabe erfüllt: Raum wird still, der Ausgang öffnet sich. */
function completeRoom(g: Game) {
  g.phase = 'exit';
  g.events.push('roomClear');
  for (const e of g.enemies) g.blasts.push({ x: e.x, y: e.y, r: ENEMIES[e.kind].r * 1.6, t: BLAST_TIME, kind: 'wreck' });
  clearRoom(g);
  award(g, POINTS_ROOM * (g.roomHit ? 1 : NO_HIT_BONUS), 1, ARENA / 2, ARENA / 2);
  // Beute: eine Auswahl aus drei Dingen; nach einem Boss bringt jedes zwei Stufen
  g.offers = rollOffers(g, g.plan.objective === 'boss' ? 2 : 1);
}

export function step(g: Game, input: Input) {
  // Solange eine Beute-Auswahl offen ist, steht das Spiel
  if (g.over || g.offers.length > 0) return;
  g.time += STEP;
  g.popups = g.popups.filter((p) => (p.t -= STEP) > 0);
  g.blasts = g.blasts.filter((b) => (b.t -= STEP) > 0);
  g.arcs = g.arcs.filter((a) => (a.t -= STEP) > 0);
  if (g.streak > 0) {
    g.streakTimer -= STEP;
    if (g.streakTimer <= 0) g.streak = 0;
  }

  if (g.phase === 'transition') {
    g.transition += STEP;
    if (g.transition >= RUN_OUT_TIME + SLIDE_TIME) {
      g.x = g.prevX = ENTRY_X;
      g.y = g.prevY = EXIT_Y;
      g.vx = g.vy = 0;
      g.air = 0;
      g.ducking = g.sliding = false;
      enterRoom(g, g.room + 1);
    }
    return;
  }

  stepPlayer(g, input);

  stepPickups(g);

  if (g.phase === 'exit') {
    stepPlayerBeam(g);
    stepBullets(g);
    // Durch den Ausgang in der rechten Wand geht es in den nächsten Raum
    if (g.x >= ARENA - PLAYER_R - 1 && Math.abs(g.y - EXIT_Y) < EXIT_HALF) {
      g.phase = 'transition';
      g.transition = 0;
      g.exitFromX = g.x;
      g.exitFromY = g.y;
      g.aimX = 1;
      g.aimY = 0;
      g.dashTime = 0;
      g.dashing = false;
      g.bullets = [];
      g.playerBeam = null;
    }
    return;
  }

  stepSpawns(g);
  stepPlayerBeam(g);
  stepBullets(g);
  stepHazards(g);
  stepEnemies(g);

  // Aufgabe
  switch (g.plan.objective) {
    case 'collect':
      for (const b of g.bananas) {
        if (Math.hypot(b.x - g.x, b.y - g.y) < PLAYER_R + BANANA_R + g.stats.pickup) {
          g.progress++;
          g.events.push('pickup');
          award(g, POINTS_BANANA, 1, b.x, b.y);
          Object.assign(b, spot(g, 50, 150));
        }
      }
      break;
    case 'clear':
      g.progress = g.roomKills;
      break;
    case 'survive':
      g.progress += STEP;
      break;
    case 'destroy':
      break; // zählt hazards.ts beim Zerstören eines Geschützes
    case 'boss':
      g.progress = g.enemies.some((e) => e.kind === 'boss' && !e.dead) ? 0 : 1;
      break;
  }

  if (g.hp <= 0) {
    if (g.lives > 0) {
      // Extra-Leben: an Ort und Stelle wieder da, mit Druckwelle und Schonzeit
      g.lives--;
      g.hp = g.stats.maxHp;
      explode(g, g.x, g.y, 160, 60, 0, 'env', 0, 'revive');
      g.shield = REVIVE_SHIELD;
    } else {
      g.hp = 0;
      g.over = true;
      g.events.push('die');
    }
  } else if (g.progress >= g.plan.goal) {
    completeRoom(g);
  }
}
