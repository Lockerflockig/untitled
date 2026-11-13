// Rechnet die Spielregeln ohne Browser durch. Aufruf: npm test
// (Node ab 22.6, läuft die TypeScript-Dateien direkt.)

import { STEP } from '../src/sim/types.ts';
import type { BossAbility, Enemy, EnemyKind, Field, Game, Input, Laser, Stats } from '../src/sim/types.ts';
import { newGame, roomPlan, step } from '../src/sim/game.ts';
import {
  BOMB_SPEED, CHARGE_LOAD, CHARGE_LOCK, PYLON_TIME, RETREAT_SHOW, SHIELD_BLAST_RADIUS, SHIELD_TURN, SPAWN_WARN, alarmsOf,
  bossTint, makeEnemy, startAbility,
} from '../src/sim/enemies.ts';
import { ALARM_INTERVAL, AlarmLoops } from '../src/alarmLoop.ts';
import { spawnLaser } from '../src/sim/hazards.ts';
import { ENEMIES, enemyStats } from '../src/sim/core.ts';
import { describeOffer, rollOffers, takeOffer } from '../src/sim/loot.ts';
import {
  buyCharacter, buyUnlock, buyUpgrade, defaultSave, sanitize, selectCharacter, statsFrom,
} from '../src/sim/meta.ts';

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ': ' + JSON.stringify(detail)}`);
}

const baseStats = (over: Partial<Stats> = {}): Stats => ({ ...statsFrom(defaultSave()), ...over });

/** Spiel ohne Zufalls-Ereignisse: keine neuen Gegner, keine neuen Laser, Aufgabe nicht erfüllbar. */
function quiet(stats = baseStats(), room = 1): Game {
  const g = newGame(stats);
  g.room = room;
  g.plan = { ...roomPlan(room), beamEvery: null, fieldEvery: null };
  g.spawnTimer = g.laserTimer = 1e9;
  g.bananas = [];
  g.mines = [];
  g.barrels = [];
  g.turrets = [];
  return g;
}
const idle = (g: Game, over: Partial<Input> = {}): Input => ({
  moveX: 0, moveY: 0, aimX: g.x + 1000, aimY: g.y,
  fire: false, duck: false, dash: false, jump: false, kick: false, swap: false, ...over,
});
const run = (g: Game, seconds: number, input: (g: Game) => Partial<Input> = () => ({})) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(g, idle(g, input(g)));
};
const add = (g: Game, kind: EnemyKind, dx: number, dy = 0) => {
  const e = makeEnemy(kind, g.x + dx, g.y + dy);
  e.angle = Math.PI; // schaut zur Figur, wenn er rechts von ihr steht
  g.enemies.push(e);
  return e;
};
/** Boss-Raum ohne Zufall von außen: keine Begleiter, Laser, Fässer, Minen oder Geschütze. */
function bossRoom(room: number): Game {
  const g = newGame(baseStats(), room);
  g.laserTimer = g.spawnTimer = 1e9;
  g.barrels = [];
  g.mines = [];
  g.turrets = [];
  return g;
}
const laser = (height: Laser['height'], pos: number): Laser => ({ vertical: true, pos, speed: 0, height, warn: 0, life: 1e9 });

console.log('--- Laser-Höhen ---');
for (const [height, state, expectHit] of [
  ['low', 'stehen', true], ['low', 'springen', false], ['low', 'ducken', true],
  ['high', 'stehen', true], ['high', 'springen', true], ['high', 'ducken', false],
  ['full', 'stehen', true], ['full', 'springen', true], ['full', 'ducken', true], ['full', 'dash', false],
] as const) {
  const g = quiet();
  if (state === 'ducken') run(g, 0.05, () => ({ duck: true }));
  if (state === 'springen') step(g, idle(g, { jump: true }));
  g.lasers.push(laser(height, g.x));
  const along = (g: Game) => ({ aimX: g.x, aimY: g.y + 1000 }); // Dash entlang des Lasers
  if (state === 'dash') step(g, idle(g, { dash: true, ...along(g) }));
  run(g, 0.1, (g) => ({ duck: state === 'ducken', ...(state === 'dash' ? along(g) : {}) }));
  check(`Laser ${height}, ${state}`, (g.hp < 100) === expectHit, { hp: g.hp });
}

console.log('--- Laser: nur noch „voll" ---');
{
  // Mit festem Zufall, damit die Prüfung nicht von Glück abhängt
  const original = Math.random;
  let seed = 20240607;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const g = quiet();
  try {
    for (let i = 0; i < 400; i++) spawnLaser(g);
  } finally {
    Math.random = original;
  }
  const moving = g.lasers.filter((l) => l.speed !== 0).length;
  check('Aus 400 erzeugten Lasern hat jeder die Höhe „voll"', g.lasers.length === 400 && g.lasers.every((l) => l.height === 'full'),
    [...new Set(g.lasers.map((l) => l.height))]);
  check('Rund ein Viertel der Laser ist beweglich (statisch zu beweglich 3 : 1)', moving >= 72 && moving <= 128, { moving });
  check('Vorwarnung, Dauer und Tempo bleiben: Sperrlaser 3 s, Wanderlaser 200 px/s',
    g.lasers.every((l) => l.warn === 1 && (l.speed === 0 ? l.life === 3 : Math.abs(l.speed) === 200 && l.life === Infinity)));
}
for (const state of ['stehen', 'ducken', 'springen', 'dash'] as const) {
  const g = quiet();
  if (state === 'ducken') run(g, 0.05, () => ({ duck: true }));
  if (state === 'springen') step(g, idle(g, { jump: true }));
  g.lasers.push({ vertical: true, pos: g.x - 20, speed: 200, height: 'full', warn: 0, life: Infinity }); // fährt über die Figur
  const along = (g: Game) => ({ aimX: g.x, aimY: g.y + 1000 }); // Dash entlang des Lasers
  if (state === 'dash') step(g, idle(g, { dash: true, ...along(g) }));
  run(g, 0.4, (g) => ({ duck: state === 'ducken', ...(state === 'dash' ? along(g) : {}) }));
  check(`Beweglicher Laser, ${state}: ${state === 'dash' ? 'I-Frames schützen' : 'trifft (25 Schaden)'}`,
    g.hp === (state === 'dash' ? 100 : 75), { hp: g.hp });
}

console.log('--- Kick, Domino, Wrack ---');
{
  const g = quiet();
  g.x = g.prevX = 100;
  const e = add(g, 'hunter', 40);
  step(g, idle(g, { kick: true }));
  check('Kick trifft und schleudert', e.kicked && e.hp === 35, { hp: e.hp });
  run(g, 0.7);
  check('Kick-Flug ist überspitzt: über 300 px', e.x - g.x > 300 && e.hp === 35, { dx: Math.round(e.x - g.x), hp: e.hp });
}
{
  const g = quiet();
  g.x = g.prevX = 650;
  const e = add(g, 'hunter', 40);
  step(g, idle(g, { kick: true }));
  run(g, 0.4);
  check('Aufprall auf die Wand: 30 Schaden', e.hp === 5, { hp: e.hp });
}
{
  const g = quiet();
  const e = add(g, 'hunter', -40);
  step(g, idle(g, { kick: true }));
  check('Kick trifft nur im Bogen vor der Figur', e.hp === 40, { hp: e.hp });
}
{
  const g = quiet();
  add(g, 'hunter', 40);
  g.lasers.push(laser('full', g.x + 150));
  step(g, idle(g, { kick: true }));
  run(g, 0.3);
  check('Kick in den Laser tötet, 100 × 2', g.enemies.every((e) => e.dead) && g.score === 200, { score: g.score });
}
{
  const g = quiet();
  const e = add(g, 'hunter', 150);
  g.lasers.push(laser('full', g.x + 150));
  run(g, 0.3);
  check('Gegner ohne Kick sind laserimmun', e.hp === 40, { hp: e.hp });
}
{
  const g = quiet();
  g.x = g.prevX = 100;
  const group = [add(g, 'hunter', 36), add(g, 'hunter', 34, -22), add(g, 'hunter', 34, 22)];
  step(g, idle(g, { kick: true }));
  run(g, 0.3);
  check('Gruppen-Kick: alle fliegen, nur Kick-Schaden', group.every((e) => e.hp === 35 && e.x - g.x > 200),
    group.map((e) => ({ hp: e.hp, dx: Math.round(e.x - g.x) })));
}
{
  const g = quiet();
  g.x = g.prevX = 100;
  const [a, b, c] = [add(g, 'hunter', 40), add(g, 'hunter', 130), add(g, 'hunter', 220)];
  step(g, idle(g, { kick: true }));
  run(g, 0.6);
  check('Domino: Kette erreicht die dritte Drohne', a.hp === 15 && b.hp <= 0 && c.hp === 20 && c.x - g.x > 300,
    { a: a.hp, b: b.hp, c: c.hp, cdx: Math.round(c.x - g.x) });
}
{
  const g = quiet();
  g.x = g.prevX = 100;
  const weak = add(g, 'hunter', 40);
  weak.hp = 5;
  const second = add(g, 'hunter', 130);
  step(g, idle(g, { kick: true }));
  const atKick = { score: g.score, wreck: weak.dead, there: g.enemies.includes(weak) };
  run(g, 0.3);
  check('Tödlicher Kick: Punkte sofort, Wrack trifft die nächste', atKick.score === 150 && atKick.wreck && atKick.there && second.hp === 20,
    { atKick, second: second.hp });
  run(g, 1.5);
  check('Wrack verschwindet nach dem Flug', g.enemies.every((e) => !e.dead));
}
{
  const g = quiet();
  g.x = g.prevX = 100;
  const light = add(g, 'hunter', 50, -25);
  const heavy = add(g, 'heavy', 60, 35);
  step(g, idle(g, { kick: true, aimX: g.x + 1000, aimY: g.y }));
  run(g, 0.5);
  check('Schwerer Mech fliegt viel kürzer als eine Jagddrohne', light.x - g.x > 2.5 * (heavy.x - g.x),
    { light: Math.round(light.x - g.x), heavy: Math.round(heavy.x - g.x) });
}

console.log('--- Punkte ---');
{
  const g = quiet();
  add(g, 'hunter', 200);
  run(g, 0.9, () => ({ fire: true }));
  const afterGun = g.score;
  add(g, 'hunter', 60);
  step(g, idle(g, { dash: true }));
  run(g, 0.2);
  check('Pistolen-Kill 100, dann Dash-Kill 100 × 1,5 × 1,1 = 165', afterGun === 100 && g.score === 265, { afterGun, score: g.score });
  run(g, 4.1);
  check('Serie verfällt nach 4 s', g.streak === 0);
}
{
  const g = quiet();
  add(g, 'hunter', 50);
  add(g, 'hunter', 110);
  step(g, idle(g, { dash: true }));
  run(g, 0.2);
  check('Dash-Doppelkill: 150 + 100 × (1,5 + 0,5) × 1,1 = 370', g.score === 370, { score: g.score });
}
{
  const g = quiet();
  g.streak = 5;
  g.streakTimer = 4;
  add(g, 'hunter', 20);
  run(g, 0.5); // Ausholen 0,35 s, dann der Schlag
  check('Treffer setzt die Serie zurück', g.streak === 0 && g.hp === 85, { streak: g.streak, hp: g.hp });
}
{
  const g = quiet(baseStats(), 3);
  add(g, 'hunter', 200);
  run(g, 0.9, () => ({ fire: true }));
  check('Raum-Multiplikator: Raum 3 gibt ×1,5', g.score === 150, { score: g.score });
}

console.log('--- Gegnertypen ---');
{
  const g = quiet();
  const front = add(g, 'shield', 150);
  run(g, 1, () => ({ fire: true }));
  const g2 = quiet();
  const back = add(g2, 'shield', 150);
  back.angle = 0; // dreht der Figur den Rücken zu
  run(g2, 0.15, () => ({ fire: true }));
  check('Schilddrohne blockt Schüsse von vorn, nicht von hinten', front.hp === 60 && back.hp < 60, { front: front.hp, back: back.hp });
}
{
  const standing = quiet();
  add(standing, 'gunner', 300);
  run(standing, 3.5);
  const ducked = quiet();
  add(ducked, 'gunner', 300);
  run(ducked, 3.5, () => ({ duck: true }));
  check('Geschützdrohne trifft im Stehen, Ducken weicht aus', standing.hp < 100 && ducked.hp === 100, { standing: standing.hp, ducked: ducked.hp });
}
{
  const g = quiet();
  add(g, 'bomber', 200);
  run(g, 2);
  check('Sprengdrohne detoniert an der Figur: 30 Schaden, keine Punkte', g.hp === 70 && g.score === 0 && g.enemies.length === 0,
    { hp: g.hp, score: g.score, enemies: g.enemies.length });
}

console.log('--- Skalierung mit dem Level ---');
{
  const [one, six] = [enemyStats('hunter', 1), enemyStats('hunter', 6)];
  check('Jagddrohne: Level 1 hat die Grundwerte, Level 6 nach der Formel (64 / 20 / 191)',
    one.hp === 40 && one.damage === 15 && one.speed === 165 && six.hp === 64 && six.damage === 20 && six.speed === 191, { one, six });
  const e = makeEnemy('hunter', 100, 100, 6);
  check('Der Gegner trägt seine Werte selbst', e.level === 6 && e.maxHp === 64 && e.hp === 64 && e.damage === 20 && e.speed === 191,
    { level: e.level, hp: e.hp, damage: e.damage, speed: e.speed });
  check('Ohne Level ist es Level 1', makeEnemy('hunter', 0, 0).level === 1 && makeEnemy('hunter', 0, 0).maxHp === 40);
}
{
  const speeds = [1, 5, 10, 16, 20, 40, 100].map((n) => enemyStats('hunter', n).speed);
  check('Tempo der Jagddrohne erreicht 250 und bleibt dort', enemyStats('hunter', 40).speed === 250 && speeds.every((v) => v <= 250)
    && speeds.slice(-3).every((v) => v === 250), speeds);
  const kinds = Object.keys(ENEMIES) as EnemyKind[];
  check('Jeder Typ stößt an seine Tempo-Grenze, und keine liegt über dem Tempo der Figur ohne Upgrades (300)',
    kinds.every((k) => enemyStats(k, 200).speed === ENEMIES[k].speedMax && ENEMIES[k].speedMax <= 300),
    kinds.map((k) => [k, enemyStats(k, 200).speed]));
  check('Leben wächst ohne Grenze, Schaden ebenfalls (Level 20: ×6,1 und ×3,0)',
    enemyStats('hunter', 20).hp === Math.round(40 * 1.1 ** 19) && enemyStats('hunter', 20).damage === Math.round(15 * 1.06 ** 19)
    && enemyStats('hunter', 21).hp > enemyStats('hunter', 20).hp);
}
{
  const g = quiet();
  g.hp = 100;
  const e = makeEnemy('heavy', g.x + 20, g.y, 6);
  g.enemies.push(e);
  run(g, 0.05);
  check('Berührung eines Gegners aus Level 6 zieht den skalierten Schaden ab (30 → 40)', g.hp === 60, { hp: g.hp });
}
{
  const shotDamage = (level: number) => {
    const g = quiet();
    g.enemies.push(makeEnemy('gunner', g.x + 300, g.y, level));
    for (let i = 0; i < 400 && g.shots.length === 0; i++) step(g, idle(g));
    return g.shots[0]?.damage;
  };
  check('Geschoss einer Geschützdrohne aus Level 6 macht mehr Schaden als aus Level 1 (16 gegen 12)',
    shotDamage(1) === 12 && shotDamage(6) === 16, { one: shotDamage(1), six: shotDamage(6) });
}
{
  const g = quiet(baseStats(), 6);
  g.spawnTimer = 0;
  run(g, 1.3);
  check('Erscheinende Gegner bekommen das Level des Raums', g.enemies.length > 0
    && g.enemies.every((e) => e.level === 6 && e.maxHp === enemyStats(e.kind, 6).hp && e.speed === enemyStats(e.kind, 6).speed),
    g.enemies.map((e) => [e.kind, e.level, e.maxHp]));
}
{
  const killScore = (level: number) => {
    const g = quiet();
    const e = makeEnemy('hunter', g.x + 200, g.y, level);
    e.hp = 1;
    g.enemies.push(e);
    run(g, 0.9, () => ({ fire: true }));
    return g.score;
  };
  check('Punkte, Radius und Masse bleiben in Level 20 gleich (100 Punkte)',
    killScore(1) === 100 && killScore(20) === 100 && Object.keys(enemyStats('hunter', 20)).sort().join() === 'damage,hp,speed'
    && ENEMIES.hunter.r === 14 && ENEMIES.hunter.mass === 1 && ENEMIES.hunter.points === 100,
    { one: killScore(1), twenty: killScore(20) });
}
{
  const kinds = (n: number) => roomPlan(n).mix.map(([k]) => k).join();
  check('Gegnertypen kommen ab ihrem Level dazu: Geschütz 3, Sprengdrohne 4, Schild 6, Schwerer Mech 7',
    kinds(1) === 'hunter' && kinds(2) === 'hunter' && kinds(3) === 'hunter,gunner' && kinds(4) === 'hunter,gunner,bomber'
    && kinds(6) === 'hunter,gunner,bomber,shield' && kinds(7) === 'hunter,gunner,bomber,shield,heavy', [1, 3, 4, 6, 7].map(kinds));
  check('Anzahl und Erscheinungsrate wachsen weiter mit dem Level, die heutigen Werte bleiben',
    roomPlan(1).maxEnemies === 6 && roomPlan(4).maxEnemies === 9 && roomPlan(9).maxEnemies === 14 && roomPlan(19).maxEnemies === 14
    && roomPlan(5).maxEnemies === 3 && Math.abs(roomPlan(2).spawnEvery - 2.1) < 1e-9 && roomPlan(19).spawnEvery === 0.9
    && roomPlan(5).spawnEvery === 4, [1, 4, 9, 19, 5].map((n) => [roomPlan(n).maxEnemies, roomPlan(n).spawnEvery]));
}

{
  const boss = (room: number) => newGame(baseStats(), room).enemies.find((e) => e.kind === 'boss')!;
  check('Boss: Level 5 hat 900 Trefferpunkte, Level 10 nach der Formel (1450), Level = Raumnummer',
    boss(5).maxHp === 900 && boss(10).maxHp === 1450 && boss(10).level === 10 && boss(15).maxHp > boss(10).maxHp,
    { five: boss(5).maxHp, ten: boss(10).maxHp });
  check('Boss: Tempo und Berührungsschaden wachsen mit, Tempo bleibt unter 80 px/s',
    boss(5).speed === 59 && boss(10).damage === 51 && enemyStats('boss', 100).speed === 80, { speed: boss(5).speed, damage: boss(10).damage });
  // Fächer und Bodenfelder gibt es weiter; ihr Schaden skaliert mit dem Level des Bosses
  const first = (room: number, ability: 'fan' | 'fields') => {
    const g = bossRoom(room);
    const b = g.enemies.find((e) => e.kind === 'boss')!;
    startAbility(g, b, ability);
    for (let i = 0; i < 600 && g.shots.length + g.fields.length === 0; i++) step(g, idle(g));
    return ability === 'fan' ? g.shots[0]?.damage : g.fields[0];
  };
  const [shot5, shot10] = [first(5, 'fan'), first(10, 'fan')];
  const [field5, field10] = [first(5, 'fields') as Field, first(10, 'fields') as Field];
  check('Boss-Geschosse und Boss-Bodenfelder merken sich ihren Schaden mit dem Level des Bosses (Geschoss 19 → 25, Feld 25 → 34)',
    shot5 === 19 && shot10 === 25 && field5?.damage === 25 && field10?.damage === 34 && field10?.enemyDamage === 51,
    { shot5, shot10, field5, field10 });
}

console.log('--- Boss: Panzer ---');
{
  /** Raum mit Panzer im gegebenen Level, ohne Begleiter und Gefahren. Figur in der Mitte (400, 400). */
  const panzer = (level: number, x = 100, y = 400, stats = baseStats()) => {
    const g = quiet(stats, level);
    const b = makeEnemy('boss', x, y, level);
    g.enemies.push(b);
    return { g, b };
  };
  const place = (g: Game, x: number, y: number) => {
    g.x = g.prevX = x;
    g.y = g.prevY = y;
    g.vx = g.vy = 0;
  };

  // Welche Fähigkeiten er in 60 s einsetzt (Figur unverwundbar gestellt, damit sie überlebt)
  const used = (level: number) => {
    const { g, b } = panzer(level, 640, 400, baseStats({ damageTaken: 0 }));
    const seq: BossAbility[] = [];
    let backupWhileBlocked = false;
    let moved = 0;
    for (let i = 0; i < Math.round(60 / STEP); i++) {
      const s = b.boss!;
      const [phase, t, x, y] = [s.phase, s.t, b.x, b.y];
      const pushed = Math.hypot(b.pushX, b.pushY) > 1e-3; // Rückstoß von außen (Explosion, Treffer) zählt nicht
      const blocked = g.pylon !== null || g.enemies.some((e) => e.swarm && !e.dead) || g.spawns.some((sp) => sp.swarm);
      step(g, idle(g));
      g.hp = 100;
      const started = phase === 'rest' && (s.phase !== 'rest' || s.t > t);
      if (started) {
        seq.push(s.last!);
        if (s.last === 'backup' && blocked) backupWhileBlocked = true;
      }
      // zwischen den Fähigkeiten (Pause, Ankündigung, Aufladen, benommen) steht er still
      const still = ['rest', 'windup', 'charge-load', 'stunned', 'retreat-show'];
      // Andere Gegner, die sich mit ihm überlappen, schieben ihn (für alle Gegner gleich) – das zählt hier nicht
      const crowded = g.enemies.some((e) => e !== b && Math.hypot(e.x - b.x, e.y - b.y) < ENEMIES.boss.r + ENEMIES[e.kind].r + 20);
      if (!started && !crowded && !pushed && still.includes(phase) && still.includes(s.phase) && !b.kicked) moved = Math.max(moved, Math.hypot(b.x - x, b.y - y));
    }
    return { seq, set: [...new Set(seq)].sort().join(), backupWhileBlocked, moved };
  };
  const [u5, u10, u15] = [used(5), used(10), used(15)];
  check('Level 5: neben Fächer und Bodenfeldern nur der Charge', u5.set === 'charge,fan,fields', u5.set);
  check('Level 10: dazu Call Backup', u10.set === 'backup,charge,fan,fields', u10.set);
  check('Level 15: alle drei Fähigkeiten, dazu Fächer und Bodenfelder', u15.set === 'backup,charge,fan,fields,retreat', u15.set);
  check('Dieselbe Fähigkeit kommt nie zweimal hintereinander',
    [u5, u10, u15].every((u) => u.seq.every((a, i) => i === 0 || a !== u.seq[i - 1])), [u5.seq, u10.seq, u15.seq]);
  check('Kein Call Backup, solange ein Mast steht oder ein Schwarm lebt', !u10.backupWhileBlocked && !u15.backupWhileBlocked);
  check('Zwischen den Fähigkeiten bewegt er sich nicht (höchstens ein Tausendstel Pixel Nachlauf eines Rückstoßes)', u5.moved < 1e-3 && u10.moved < 1e-3 && u15.moved < 1e-3,
    [u5.moved, u10.moved, u15.moved]);

  check('Stufenfarbe: Level 5, 10 und 15 verschieden, Level 20 wie Level 15',
    new Set([bossTint(5), bossTint(10), bossTint(15)]).size === 3 && bossTint(20) === bossTint(15) && bossTint(9) === bossTint(5),
    [5, 10, 15, 20].map(bossTint));

  {
    const g = bossRoom(5);
    const b = g.enemies.find((e) => e.kind === 'boss')!;
    const start = b.x;
    run(g, 2); // Pause zu Beginn: 2,5 s
    step(g, idle(g, { kick: true, aimX: b.x, aimY: b.y }));
    b.x = g.x + 60; // in Kick-Reichweite stellen
    b.y = g.y;
    const before = b.x;
    step(g, idle(g, { kick: true, aimX: b.x, aimY: b.y }));
    run(g, 0.3);
    check('Er rollt nicht mehr auf die Figur zu und lässt sich nicht wegkicken',
      start === 640 && Math.abs(b.x - before) < 20, { moved: b.x - before });
  }

  // --- Charge ---
  const charge = (level: number, during: (g: Game, b: Enemy, t: number) => Partial<Input> | void = () => {}) => {
    const { g, b } = panzer(level);
    startAbility(g, b, 'charge');
    let hpLoaded = 100;
    let t = 0;
    let impact = -1;
    while (t < 3 && b.boss!.phase !== 'stunned') {
      step(g, idle(g, during(g, b, t) ?? {}));
      t += STEP;
      if (t < CHARGE_LOAD - STEP / 2) hpLoaded = g.hp;
    }
    if (b.boss!.phase === 'stunned') impact = t;
    return { g, b, hpLoaded, impact };
  };
  {
    const { g, b, hpLoaded } = charge(5);
    check('Charge: Während des Aufladens kein Schaden, danach trifft er die Figur in der Bahn (44 in Level 5)',
      hpLoaded === 100 && g.hp === 56, { hpLoaded, hp: g.hp });
    check('Charge: fährt bis zur Wand und bleibt dort stehen', Math.abs(b.x - (800 - ENEMIES.boss.r)) < 1 && b.y === 400, { x: b.x, y: b.y });
    check('Charge: Wer überfahren wird, fliegt quer zur Bahn beiseite', Math.abs(g.y - 400) > 30, { y: g.y });
    // benommen: 1 s lang keine Fähigkeit, keine Bewegung
    const [x, y] = [b.x, b.y];
    run(g, 0.98);
    const still = b.boss!.phase === 'stunned' && b.x === x && b.y === y && g.shots.length === 0 && g.fields.length === 0 && g.pylon === null;
    run(g, 0.04);
    check('Charge: Nach dem Aufprall 1 s untätig, danach Pause', still && b.boss!.phase === 'rest', b.boss!.phase);
  }
  {
    // Die Bahn rastet 0,3 s vor Schluss ein: Wer danach zur Seite geht, wird nicht getroffen
    const { g, b } = charge(5, (g, _b, t) => {
      if (t > CHARGE_LOAD - CHARGE_LOCK + 0.05 && g.y === 400) place(g, 400, 520);
    });
    check('Charge: neben der Bahn kein Schaden; die Bahn folgt nicht mehr', g.hp === 100 && b.y === 400 && b.boss!.angle === 0,
      { hp: g.hp, by: b.y });
  }
  {
    // Die Bahn folgt der Figur, solange sie nicht eingerastet ist
    const { g, b } = charge(5, (g, _b, t) => {
      if (t > 0.3 && t < 0.4) place(g, 400, 600);
    });
    check('Charge: Die Bahn folgt der Figur bis kurz vor Schluss', b.boss!.angle !== 0 && g.hp === 56, { angle: b.boss!.angle, hp: g.hp });
  }
  {
    let dashed = false;
    const { g } = charge(5, (g, b) => {
      if (!dashed && b.boss!.phase === 'charge-rush' && g.x - b.x < 110) {
        dashed = true;
        return { dash: true, aimX: b.x, aimY: b.y }; // durch den heranrasenden Panzer hindurch
      }
    });
    check('Charge: Ein Dash durch die Bahn schützt (I-Frames)', dashed && g.hp === 100, { hp: g.hp });
  }
  {
    const { g, b } = panzer(5);
    const hunter = add(g, 'hunter', 0, -60);
    place(g, 400, 650);
    startAbility(g, b, 'charge');
    for (let i = 0; i < Math.round(CHARGE_LOAD / STEP) - 1; i++) step(g, idle(g));
    b.boss!.angle = 0; // Bahn waagerecht durch den Gegner
    hunter.x = 300; // mitten in der Bahn
    hunter.y = 400;
    run(g, 0.3);
    check('Charge: Auch Gegner in der Bahn nehmen Schaden (als Umgebung) und fliegen beiseite',
      hunter.hp < hunter.maxHp && hunter.lastHit === 'env' && Math.abs(hunter.pushY) > 0, { hp: hunter.hp, lastHit: hunter.lastHit });
  }
  const chargeLoss = (level: number) => 100 - charge(level).g.hp;
  check('Charge: Schaden in Level 15 höher als in Level 5', chargeLoss(15) > chargeLoss(5), [chargeLoss(5), chargeLoss(15)]);

  // --- Call Backup ---
  {
    const { g, b } = panzer(10, 640, 400);
    place(g, 150, 150);
    startAbility(g, b, 'backup');
    b.boss!.t = 1e9; // danach nichts weiter
    const p = g.pylon;
    check('Call Backup: Mast in der Raummitte mit 35 % des maximalen Lebens', p !== null && p.x === 400 && p.y === 400
      && p.maxHp === Math.round(b.maxHp * 0.35) && p.hp === p.maxHp, p);
    check('Call Backup: Der Mast piept (Dauerton „pylon")', alarmsOf(g).some((a) => a.kind === 'pylon'), alarmsOf(g));
    run(g, PYLON_TIME - 0.05);
    const early = g.spawns.length + g.enemies.filter((e) => e.swarm).length;
    run(g, 0.1);
    const called = g.spawns.filter((s) => s.swarm);
    const onEdge = called.every((s) => Math.min(s.x, s.y, 800 - s.x, 800 - s.y) < 45);
    const sides = new Set(called.map((s) => (s.x < 45 ? 'l' : s.x > 755 ? 'r' : s.y < 45 ? 'o' : 'u'))).size;
    check('Call Backup: Nach 5 s werden mindestens 15 Gegner angekündigt, rundum am Rand',
      early === 0 && called.length >= 15 && onEdge && sides === 4, { early, called: called.length, sides });
    run(g, SPAWN_WARN);
    const swarm = g.enemies.filter((e) => e.swarm);
    check('Call Backup: Der Schwarm erscheint mit Typen und Werten des Levels', swarm.length >= 15
      && swarm.every((e) => e.level === 10 && g.plan.mix.some(([k]) => k === e.kind)) && !alarmsOf(g).some((a) => a.kind === 'pylon'),
      { n: swarm.length });
    g.spawnTimer = 0;
    step(g, idle(g));
    check('Call Backup: Der Schwarm zählt nicht gegen die Obergrenze des Raums', g.spawns.some((s) => !s.swarm), g.plan.maxEnemies);
  }
  const swarmCount = (level: number) => {
    const { g, b } = panzer(level, 640, 400);
    startAbility(g, b, 'backup');
    b.boss!.t = 1e9;
    run(g, PYLON_TIME + 0.05);
    return g.spawns.filter((s) => s.swarm).length;
  };
  check('Call Backup: Schwarm wächst mit dem Level (15 in Level 10, 20 in Level 15, 25 in Level 20)',
    swarmCount(10) === 15 && swarmCount(15) === 20 && swarmCount(20) === 25, [10, 15, 20].map(swarmCount));
  for (const how of ['Schuss', 'Dash'] as const) {
    const { g, b } = panzer(10, 640, 400);
    place(g, 400, 600);
    startAbility(g, b, 'backup');
    b.boss!.t = 1e9;
    g.pylon!.hp = 1;
    if (how === 'Schuss') run(g, 0.5, () => ({ fire: true, aimX: 400, aimY: 0 }));
    else {
      place(g, 400, 480);
      step(g, idle(g, { dash: true, aimX: 400, aimY: 0 }));
      run(g, 0.3);
    }
    const gone = g.pylon === null;
    run(g, PYLON_TIME + SPAWN_WARN + 0.5);
    check(`Call Backup: Mast vorher zerstört (${how}) – kein Schwarm`, gone && g.spawns.length === 0 && g.enemies.length === 1,
      { gone, spawns: g.spawns.length, enemies: g.enemies.length });
  }
  {
    const g = bossRoom(10);
    const b = g.enemies.find((e) => e.kind === 'boss')!;
    startAbility(g, b, 'backup');
    b.boss!.t = 1e9;
    run(g, PYLON_TIME + SPAWN_WARN + 0.1);
    startAbility(g, b, 'backup'); // ein zweiter Mast, erzwungen
    const both = g.pylon !== null && g.enemies.filter((e) => e.swarm).length >= 15;
    b.hp = 0;
    step(g, idle(g));
    check('Panzer zerstört: Aufgabe erfüllt, Mast und Schwarm verschwinden mit dem Raum',
      both && g.phase === 'exit' && g.pylon === null && g.enemies.length === 0 && g.spawns.length === 0, { both, phase: g.phase });
  }

  // --- Taktischer Rückzug ---
  const retreat = (level: number, dodge: boolean) => {
    const { g, b } = panzer(level, 500, 400);
    startAbility(g, b, 'retreat');
    if (dodge) place(g, 500, 200); // 90° neben der Richtung des Kegels
    run(g, RETREAT_SHOW - 0.05);
    const before = g.hp;
    run(g, 0.1);
    const after = g.hp;
    run(g, 0.5);
    return { g, b, before, after };
  };
  {
    const hit = retreat(15, false);
    check('Rückzug: 0,5 s Ankündigung ohne Schaden, dann trifft der Kegel die Figur (57 in Level 15)',
      hit.before === 100 && hit.after === 43, { before: hit.before, after: hit.after });
    check('Rückzug: Danach steht er weiter von der gemerkten Stelle entfernt (Sprung bis zur Wand)',
      Math.hypot(hit.b.x - 400, hit.b.y - 400) > 100 && Math.abs(hit.b.x - (800 - ENEMIES.boss.r)) < 1, { x: hit.b.x, y: hit.b.y });
    const miss = retreat(15, true);
    check('Rückzug: außerhalb des Kegels kein Schaden', miss.after === 100, { hp: miss.after });
    const far = (() => {
      const { g, b } = panzer(15, 250, 400);
      place(g, 150, 400);
      startAbility(g, b, 'retreat');
      run(g, 1);
      return b;
    })();
    check('Rückzug: Der Sprung reicht höchstens 400 px', Math.abs(far.x - 650) < 1 && far.y === 400,
      { x: far.x });
  }
  check('Rückzug: Kegelschaden in Level 15 höher als in Level 5', 100 - retreat(15, false).after > 100 - retreat(5, false).after,
    [retreat(5, false).after, retreat(15, false).after]);
  {
    const { g, b } = panzer(15, 500, 400);
    b.boss!.last = 'charge';
    b.boss!.t = 0; // Pause vorbei
    step(g, idle(g));
    check('Rückzug: bevorzugt, wenn die Figur näher als 250 px ist', b.boss!.ability === 'retreat', b.boss!.ability);
  }
}

console.log('--- Schilddrohne ---');
{
  check('Der Typ heißt im Spiel Schilddrohne', ENEMIES.shield.name === 'Schilddrohne');
  const turned = (level: number) => {
    const g = quiet();
    const e = makeEnemy('shield', g.x + 300, g.y, level);
    e.angle = 0; // dreht der Figur den Rücken zu
    g.enemies.push(e);
    run(g, 0.5);
    return e.angle;
  };
  const [one, twenty] = [turned(1), turned(20)];
  check('Drehrate des Schilds: in Level 1 und Level 20 gleich, 2,2 rad/s',
    Math.abs(one - twenty) < 1e-9 && Math.abs(one - SHIELD_TURN * 0.5) < 0.02, { one, twenty });
}
{
  // Die Drohne steht bei (g.x + drone, g.y); sie wird zerstört, der Nachbar steht neben ihr
  const blast = (drone: number, neighbor: number, level = 6) => {
    const g = quiet();
    const e = makeEnemy('shield', g.x + drone, g.y, level);
    g.enemies.push(e);
    const near = add(g, 'hunter', drone, neighbor);
    e.hp = 0;
    step(g, idle(g));
    return { g, e, near };
  };
  const inside = blast(60, 80);
  const outside = blast(130, 140);
  check('Zerstörte Schilddrohne (Level 6) verletzt die Figur mit 33 und den Nachbarn ebenso; sie ist weg, kein Wrack',
    inside.g.hp === 67 && inside.near.hp === 40 - 33 && !inside.g.enemies.includes(inside.e)
    && inside.g.blasts.some((b) => b.kind === 'shield' && b.r === SHIELD_BLAST_RADIUS),
    { hp: inside.g.hp, near: inside.near.hp });
  check('Außerhalb von 90 px passiert nichts', outside.g.hp === 100 && outside.near.hp === 40, { hp: outside.g.hp, near: outside.near.hp });
  const level1 = blast(60, 80, 1);
  check('In Level 1 sind es 25', level1.g.hp === 75 && level1.near.hp === 15, { hp: level1.g.hp, near: level1.near.hp });
}
{
  const g = quiet();
  g.x = g.prevX = 650;
  const e = add(g, 'shield', 40);
  e.hp = 20;
  step(g, idle(g, { kick: true }));
  run(g, 0.4);
  check('Stirbt sie im Flug (Aufprall an der Wand), explodiert sie dort, und das Wrack entfällt',
    !g.enemies.includes(e) && e.dead && g.blasts.some((b) => b.kind === 'shield') && g.marks.length === 1 && g.marks[0].x > 740 && g.hp === 100,
    { marks: g.marks, hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'shield', 200);
  g.barrels.push({ x: e.x + 50, y: e.y, fuse: null, action: 0 });
  g.mines.push({ x: e.x - 50, y: e.y, fuse: null, action: 0 });
  e.hp = 0;
  step(g, idle(g));
  check('Die Explosion zündet Fässer und Minen', g.barrels[0].fuse !== null && g.mines[0].fuse !== null);
}
{
  const g = quiet();
  const e = add(g, 'shield', 60);
  e.hp = 0;
  step(g, idle(g, { dash: true, aimX: g.x, aimY: g.y + 1000 }));
  check('I-Frames des Dashs schützen vor der Explosion', g.hp === 100 && g.blasts.some((b) => b.kind === 'shield'), { hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'shield', 200);
  const victim = add(g, 'hunter', 200, 60);
  victim.hp = 1;
  e.hp = 0;
  run(g, 0.1);
  check('Kill durch die Explosion zählt als Umgebung: 200 + 100 × 2 × 1,1',
    g.score === 200 + 220 && g.kills === 2, { score: g.score, kills: g.kills });
}
{
  const g = quiet();
  const e = add(g, 'shield', 200);
  e.hp = 0;
  step(g, idle(g));
  const at = { ...g.marks[0] };
  run(g, 60);
  const after60 = g.marks.length;
  g.progress = g.plan.goal;
  step(g, idle(g));
  const afterClear = { phase: g.phase, marks: g.marks.length };
  takeOffer(g, 0);
  for (let i = 0; i < 3 / STEP && g.room === 1; i++) step(g, idle(g, { moveX: 1 }));
  check('Spur: liegt an der Stelle, bleibt 60 s und über das Ende der Aufgabe, ist im nächsten Raum weg',
    Math.abs(at.x - (400 + 200)) < 3 && at.r === 90 && after60 === 1 && afterClear.phase === 'exit' && afterClear.marks === 1
    && g.room === 2 && g.marks.length === 0, { at, after60, afterClear, room: g.room, marks: g.marks.length });
}

console.log('--- Sprengdrohne ---');
{
  // Sie steht weit weg und läuft los; gemessen wird das Tempo über zwölf Schritte
  const speedOf = (stats: Stats, level: number) => {
    const g = quiet(stats);
    const e = makeEnemy('bomber', g.x + 350, g.y, level);
    g.enemies.push(e);
    const from = e.x;
    for (let i = 0; i < 12; i++) step(g, idle(g));
    return (from - e.x) / (12 * STEP);
  };
  const plain = baseStats();
  const fast = baseStats({ speed: 345 });
  check('Tempo der Sprengdrohne: 1,5 × Tempo der Figur, auch mit Upgrade, in Level 1 und 20 gleich',
    BOMB_SPEED === 1.5 && Math.abs(speedOf(plain, 1) - 1.5 * plain.speed) < 1e-6 && Math.abs(speedOf(plain, 20) - 1.5 * plain.speed) < 1e-6
    && Math.abs(speedOf(fast, 1) - 1.5 * 345) < 1e-6 && Math.abs(speedOf(fast, 20) - 1.5 * 345) < 1e-6,
    { plain: speedOf(plain, 1), plain20: speedOf(plain, 20), fast: speedOf(fast, 1), fast20: speedOf(fast, 20) });
}
{
  const g = quiet();
  const bomber = add(g, 'bomber', 250);
  const near = add(g, 'hunter', 250, 25);
  run(g, 0.5, () => ({ fire: true }));
  check('Abgeschossene Sprengdrohne explodiert nicht: Nachbar und Figur unverletzt, Punkte gibt es',
    !g.enemies.includes(bomber) && near.hp === 40 && g.hp === 100 && g.score === 120 && g.blasts.every((b) => b.kind !== 'bomb'),
    { near: near.hp, hp: g.hp, score: g.score, blasts: g.blasts.length });
}
{
  const g = quiet();
  g.x = g.prevX = 650;
  const bomber = add(g, 'bomber', 40);
  bomber.fuse = 0.4; // Lunte brennt schon – wer sie vorher zerstört, bleibt trotzdem ohne Explosion
  const near = add(g, 'heavy', 110, 70);
  step(g, idle(g, { kick: true }));
  run(g, 0.3);
  check('Auch mit laufender Lunte: Aufprall im Flug zerstört sie ohne Explosion (Punkte als Umgebung ×2)',
    !g.enemies.includes(bomber) && near.hp === near.maxHp && g.score === 240 && g.blasts.every((b) => b.kind !== 'bomb'),
    { near: near.hp, score: g.score, blasts: g.blasts.map((b) => b.kind) });
}
{
  const fuseAt = (dist: number, level = 1) => {
    const g = quiet();
    const e = makeEnemy('bomber', g.x + dist, g.y, level);
    e.fuse = 0.05;
    g.enemies.push(e);
    const heavy = makeEnemy('heavy', g.x + dist, g.y + 100);
    g.enemies.push(heavy);
    run(g, 0.2);
    return { g, hp: g.hp, heavy: heavy.hp, score: g.score };
  };
  const [near, far] = [fuseAt(150), fuseAt(180)];
  check('Lunte abgelaufen: trifft in 150 px Abstand (Radius 160), in 180 px nicht; keine Punkte',
    near.hp === 70 && far.hp === 100 && near.score === 0, { near: near.hp, far: far.hp, score: near.score });
  const [one, six] = [fuseAt(100, 1), fuseAt(100, 6)];
  check('Explosionsschaden in Level 6 höher als in Level 1: Figur 30 → 40, Gegner 40 → 54',
    one.hp === 70 && six.hp === 60 && one.heavy === 160 - 40 && six.heavy === 160 - 54, { one, six: { hp: six.hp, heavy: six.heavy } });
}
{
  const g = quiet();
  g.x = g.prevX = 100;
  const bomber = add(g, 'bomber', 40);
  bomber.fuse = 0.5;
  step(g, idle(g, { kick: true }));
  run(g, 0.45);
  const fuseWhileFlying = bomber.fuse;
  const victim = makeEnemy('hunter', bomber.x, bomber.y + 80);
  victim.hp = 1;
  g.enemies.push(victim);
  run(g, 0.1);
  check('Gekickt mit laufender Lunte: sie brennt im Flug weiter, explodiert am Ziel, der Kill zählt als Umgebung (100 × 2)',
    fuseWhileFlying !== null && fuseWhileFlying < 0.1 && g.blasts.some((b) => b.kind === 'bomb') && victim.dead && g.score === 200 && g.hp === 100,
    { fuse: fuseWhileFlying, score: g.score, hp: g.hp });
}

console.log('--- Warnton der Sprengdrohne ---');
{
  const g = quiet();
  g.x = g.prevX = 100; // der Kick soll nicht an der Wand enden
  const none = alarmsOf(g).length;
  const bomber = add(g, 'bomber', 40);
  const approaching = alarmsOf(g);
  step(g, idle(g, { kick: true }));
  const kicked = alarmsOf(g).length;
  run(g, 1);
  const landed = alarmsOf(g).length;
  bomber.fuse = 0.3;
  const burning = alarmsOf(g);
  bomber.hp = 0;
  step(g, idle(g));
  const dead = alarmsOf(g).length;
  check('Alarm: an, solange eine Sprengdrohne lebt und nicht gekickt ist; sonst aus; mit Lunte dringlicher',
    none === 0 && approaching.length === 1 && approaching[0].kind === 'beep' && approaching[0].urgency === 0
    && kicked === 0 && landed === 1 && burning[0].urgency > 0.5 && dead === 0,
    { none, approaching, kicked, landed, burning, dead });
  const room = quiet();
  add(room, 'bomber', 300);
  room.progress = room.plan.goal;
  step(room, idle(room));
  const over = quiet();
  add(over, 'bomber', 300);
  over.over = true;
  check('Alarm ist aus, wenn der Raum still ist oder das Spiel zu Ende', alarmsOf(room).length === 0 && room.phase === 'exit' && alarmsOf(over).length === 0);
}
{
  const loops = new AlarmLoops();
  const calm = [{ kind: 'beep' as const, urgency: 0 }];
  const beeps = (t: number, active = calm, loop = true) => loops.update(active, t, () => loop).filter((c) => c.action === 'beep').length;
  const first = beeps(0);
  const early = beeps(ALARM_INTERVAL[0] - 0.05);
  const due = beeps(ALARM_INTERVAL[0] + 0.01);
  const urgent = [{ kind: 'beep' as const, urgency: 1 }];
  const quick = beeps(ALARM_INTERVAL[0] + 0.01 + ALARM_INTERVAL[1] + 0.01, urgent);
  const stopped = loops.update([], 5, () => true);
  const again = loops.update([], 5.1, () => true);
  check('Schleife: piept sofort, im Takt, dringlicher schneller, und endet sofort, wenn die Bedingung fällt',
    first === 1 && early === 0 && due === 1 && quick === 1 && stopped.length === 1 && stopped[0].action === 'stop' && again.length === 0,
    { first, early, due, quick, stopped, again });
  const once = new AlarmLoops();
  const count = (t: number, active: typeof calm) => once.update(active, t, () => false).filter((c) => c.action === 'beep').length;
  const [c0, c1, c2] = [count(0, calm), count(30, calm), count(60, calm)];
  once.update([], 61, () => false);
  const c3 = count(62, calm);
  check('Schleife ausgeschaltet: der Ton ertönt nur einmal beim Angehen, erneut erst nach einer Pause der Bedingung',
    c0 === 1 && c1 === 0 && c2 === 0 && c3 === 1, { c0, c1, c2, c3 });
}

console.log('--- Jagddrohne: Nahkampf ---');
{
  const g = quiet();
  const e = add(g, 'hunter', 30);
  run(g, 0.05);
  const x = e.x;
  run(g, 0.15);
  const whileWinding = { hp: g.hp, phase: e.melee?.phase, still: e.x === x };
  run(g, 0.25);
  check('Berührung verletzt nicht sofort: erst nach dem Ausholen (0,35 s), dann 15 Schaden; beim Ausholen steht sie still',
    whileWinding.hp === 100 && whileWinding.phase === 'windup' && whileWinding.still && g.hp === 85 && e.melee?.phase === 'recover',
    { whileWinding, hp: g.hp });
}
{
  const g = quiet();
  add(g, 'hunter', 40);
  run(g, 0.45, () => ({ moveX: -1 }));
  check('Läuft die Figur beim Ausholen aus der Reichweite, bleibt sie unverletzt', g.hp === 100, { hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'hunter', 40);
  run(g, 0.1);
  g.x = g.prevX = e.x + 40; // steht nun hinter der Drohne: in Reichweite, aber nicht im Bogen
  run(g, 0.4);
  check('Steht die Figur beim Schlag außerhalb des Bogens (halber Winkel 60°), bleibt sie unverletzt', g.hp === 100, { hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'hunter', 40);
  run(g, 0.1);
  const winding = e.melee?.phase === 'windup';
  step(g, idle(g, { kick: true }));
  const aborted = e.melee === null && e.kicked;
  run(g, 0.7);
  check('Ein Kick beim Ausholen bricht den Angriff ab', winding && aborted && g.hp === 100, { winding, aborted, hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'hunter', 40);
  run(g, 0.1);
  step(g, idle(g, { fire: true }));
  step(g, idle(g));
  const aborted = e.melee === null;
  run(g, 0.3); // ohne Abbruch käme der Schlag 0,25 s nach dem Schuss
  check('Ein Treffer mit Rückstoß bricht das Ausholen ab', aborted && g.hp === 100, { aborted, hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'hunter', 40);
  run(g, 0.1);
  step(g, idle(g, { dash: true }));
  run(g, 0.35);
  check('Ein Dash durch die Drohne beim Ausholen schützt die Figur', e.hp < e.maxHp && g.hp === 100, { hunter: e.hp, hp: g.hp });
}
{
  const g = quiet();
  const e = add(g, 'hunter', 30);
  let t = 0;
  while (g.hp === 100 && t < 1) {
    step(g, idle(g));
    t += STEP;
  }
  const struck = { hp: g.hp, phase: e.melee?.phase };
  run(g, 0.45);
  const recovering = e.melee?.phase === 'recover';
  run(g, 0.1);
  const windingAgain = e.melee?.phase === 'windup';
  run(g, 0.2); // noch kein zweiter Schlag: 0,5 s Erholen + 0,35 s Ausholen
  const hpBetween = g.hp;
  run(g, 0.2);
  check('Nach dem Schlag vergeht die Erholzeit (0,5 s), dann holt sie neu aus; der zweite Schlag kommt erst 0,85 s nach dem ersten',
    struck.hp === 85 && struck.phase === 'recover' && recovering && windingAgain && hpBetween === 85 && g.hp === 70,
    { struck, recovering, windingAgain, hpBetween, hp: g.hp });
}
{
  const g = quiet();
  g.enemies.push(makeEnemy('hunter', g.x + 30, g.y, 6));
  run(g, 0.5);
  check('Jagddrohne aus Level 6: Schlag mit skaliertem Schaden (20), Leben 64', g.hp === 80 && g.enemies[0].maxHp === 64, { hp: g.hp });
  const speeds = Array.from({ length: 200 }, (_, i) => enemyStats('hunter', i + 1).speed);
  check('Tempo der Jagddrohne überschreitet in keinem Level 250', Math.max(...speeds) === 250);
}
{
  const g = quiet();
  const heavy = makeEnemy('heavy', g.x + 20, g.y);
  g.enemies.push(heavy);
  run(g, 0.05);
  check('Der Schwere Mech verletzt weiter durch Berührung (noch ohne Angriffsanimation)', g.hp === 70 && heavy.melee === null, { hp: g.hp });
}

console.log('--- Gefahren ---');
{
  const g = quiet();
  g.mines.push({ x: g.x + 30, y: g.y, fuse: null, action: 0 });
  g.air = 0.45;
  run(g, 0.3);
  const whileJumping = g.mines[0].fuse;
  run(g, 1);
  check('Mine: Überspringen löst nicht aus, danach 30 Schaden', whileJumping === null && g.hp === 70 && g.mines.length === 0,
    { whileJumping, hp: g.hp });
}
{
  const g = quiet();
  g.barrels.push({ x: g.x + 250, y: g.y, fuse: null, action: 0 });
  const e = add(g, 'hunter', 300);
  run(g, 0.5, () => ({ fire: true }));
  check('Fass: Schuss zündet es, Explosion tötet mit × 2', e.hp <= 0 && g.score === 200 && g.barrels.length === 0, { hp: e.hp, score: g.score });
}
{
  const hit = quiet();
  hit.fields.push({ x: hit.x, y: hit.y, r: 70, warn: 0.2, active: 0.35 });
  run(hit, 0.3);
  const jumped = quiet();
  jumped.fields.push({ x: jumped.x, y: jumped.y, r: 70, warn: 0.2, active: 0.35 });
  run(jumped, 0.15);
  step(jumped, idle(jumped, { jump: true }));
  run(jumped, 0.44);
  check('Bodenfeld: 20 Schaden im Stehen, Springen weicht aus', hit.hp === 80 && jumped.hp === 100, { hit: hit.hp, jumped: jumped.hp });
}
{
  const beam = () => ({ ox: 0, oy: 400, dx: 1, dy: 0, phase: 'lock' as const, t: 0.1 });
  const hit = quiet();
  hit.beams.push(beam());
  run(hit, 0.4);
  const ducked = quiet();
  ducked.beams.push(beam());
  run(ducked, 0.4, () => ({ duck: true }));
  check('Zielstrahl: 30 Schaden im Stehen, Ducken weicht aus', hit.hp === 70 && ducked.hp === 100 && hit.beams.length === 0,
    { hit: hit.hp, ducked: ducked.hp });
}
{
  const g = quiet(baseStats(), 6);
  g.turrets.push({ x: g.x + 300, y: g.y, hp: 60, cooldown: 0.2, hitFlash: 0, dashHit: false });
  run(g, 1.3);
  const hpAfterShot = g.hp;
  run(g, 1, () => ({ fire: true, duck: true }));
  check('Geschütz: schießt, lässt sich zerstören und zählt für die Aufgabe', hpAfterShot === 85 && g.turrets.length === 0 && g.progress === 1,
    { hpAfterShot, turrets: g.turrets.length, progress: g.progress });
}

console.log('--- Waffen ---');
{
  const g = quiet(baseStats({ weapons: ['shotgun'] }));
  step(g, idle(g, { fire: true }));
  check('Schrot: sechs Projektile', g.bullets.length === 6, { bullets: g.bullets.length });
}
{
  const g = quiet(baseStats({ weapons: ['rail'] }));
  add(g, 'hunter', 150);
  add(g, 'hunter', 220);
  run(g, 0.3, () => ({ fire: true, duck: true }));
  const whileCharging = g.kills;
  run(g, 0.3, () => ({ fire: true, duck: true }));
  check('Schwerlaser: lädt erst auf, tötet dann zwei in einer Linie, zweiter mit Aufschlag',
    whileCharging === 0 && g.kills === 2 && g.score === 100 + 165 && g.playerBeam === null && g.bullets.length === 0,
    { whileCharging, kills: g.kills, score: g.score });
}
{
  const g = quiet(baseStats({ weapons: ['rail'] }));
  add(g, 'shield', 150);
  const behind = add(g, 'hunter', 250);
  run(g, 0.6, () => ({ fire: true, duck: true }));
  check('Schwerlaser: Schilddrohne von vorn hält den Strahl auf', behind.hp === behind.maxHp && g.kills === 0, { hp: behind.hp });
}
{
  const g = quiet(baseStats({ weapons: ['rail'] }));
  const e = add(g, 'heavy', 200);
  run(g, 0.6, () => ({ fire: true, duck: true }));
  check('Schwerlaser: trifft jeden Gegner nur einmal je Strahl', e.maxHp - e.hp === 60, { damage: e.maxHp - e.hp });
}
{
  const g = quiet(baseStats({ weapons: ['grenade'] }));
  add(g, 'hunter', 250);
  add(g, 'hunter', 290, 30);
  add(g, 'hunter', 290, -30);
  run(g, 0.7, () => ({ fire: true, duck: true }));
  check('Granate: tötet die Gruppe, verletzt die Figur nicht', g.kills === 3 && g.hp === 100, { kills: g.kills, hp: g.hp });
}
{
  const g = quiet(baseStats({ weapons: ['grenade'] }));
  step(g, idle(g, { fire: true, duck: true, aimX: g.x + 200, aimY: g.y }));
  run(g, 0.6, (g) => ({ aimX: g.x + 200, aimY: g.y }));
  const blast = g.blasts[0] ?? { x: NaN };
  check('Granate landet am Fadenkreuz', Math.abs(blast.x - (g.x + 200)) < 12, { blastDx: Math.round(blast.x - g.x) });
}
{
  const g = quiet(baseStats({ weapons: ['pistol', 'shotgun'] }));
  step(g, idle(g, { swap: true }));
  step(g, idle(g, { fire: true }));
  check('Waffenwechsel', g.weapon === 1 && g.bullets.length === 6);
}

console.log('--- Räume ---');
{
  const plans = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(roomPlan);
  check('Raumfolge: Aufgaben und Neuzugänge, jeder fünfte Raum ein Boss',
    plans.map((p) => p.objective).join() === 'collect,clear,collect,survive,boss,destroy,clear,collect,survive,boss'
    && plans[0].barrels === 0 && plans[1].barrels > 0 && plans[2].fieldEvery !== null && plans[3].mines > 0
    && plans[5].turrets === plans[5].goal && plans[6].beamEvery !== null && plans[6].mix.some(([k]) => k === 'heavy'),
    plans.map((p) => p.objective));
}
{
  const g = bossRoom(5);
  const boss = g.enemies.find((e) => e.kind === 'boss')!;
  boss.hp = 1;
  boss.x = g.x + 150;
  boss.y = g.y;
  run(g, 0.5, (g) => ({ fire: true, duck: true }));
  check('Boss besiegt: 2000 Punkte × Raum-Multiplikator, Ausgang öffnet sich', g.phase === 'exit' && g.kills === 1 && g.score >= 2000 * 2,
    { phase: g.phase, kills: g.kills, score: g.score });
  check('Zweiter Boss hat mehr Trefferpunkte, nach der Formel (Level 10: 615 × 1,1⁹)', newGame(baseStats(), 10).enemies[0].maxHp === Math.round(615 * 1.1 ** 9));
}
{
  const g = quiet();
  add(g, 'hunter', 300);
  g.lasers.push(laser('full', 100));
  g.progress = g.plan.goal;
  step(g, idle(g));
  check('Aufgabe erfüllt: Raum wird still, Bonus 500 × 1,5 ohne Treffer',
    g.phase === 'exit' && g.enemies.length === 0 && g.lasers.length === 0 && g.score === 750, { phase: g.phase, score: g.score });
  g.hp = 60;
  const xBefore = g.x;
  run(g, 0.5, () => ({ moveX: 1 }));
  check('Offene Beute-Auswahl hält das Spiel an', g.offers.length === 3 && g.x === xBefore, { offers: g.offers.length });
  takeOffer(g, 0);
  for (let i = 0; i < 3 / STEP && g.room === 1; i++) step(g, idle(g, { moveX: 1 }));
  check('Durch den Ausgang in Raum 2: Trefferpunkte bleiben, Punkte ×1,25',
    g.room === 2 && g.phase === 'play' && g.hp === 60 && g.x === 50 && g.plan.multiplier === 1.25 && g.plan.objective === 'clear',
    { room: g.room, phase: g.phase, hp: g.hp, x: Math.round(g.x) });
}
{
  const g = quiet(baseStats(), 2);
  add(g, 'hunter', 200);
  run(g, 0.9, () => ({ fire: true }));
  const clear = g.progress;
  const s = quiet(baseStats(), 4);
  run(s, 2);
  check('Aufgaben zählen: Säubern nach Kills, Überleben nach Zeit', clear === 1 && Math.abs(s.progress - 2) < 0.01, { clear, survive: s.progress });
}
{
  const g = quiet(baseStats({ extraLives: 1 }));
  add(g, 'hunter', 60);
  g.hp = 1;
  g.lasers.push(laser('full', g.x));
  run(g, 0.1);
  const revived = { hp: g.hp, lives: g.lives, over: g.over };
  g.hp = 1;
  run(g, 3);
  check('Extra-Leben belebt einmal wieder, danach ist Schluss', revived.hp === 100 && revived.lives === 0 && !revived.over && g.over, { revived, over: g.over });
}

console.log('--- Loot ---');
{
  const g = quiet();
  g.offers = [{ kind: 'weapon', id: 'pistol', levels: 1 }];
  takeOffer(g, 0);
  check('Standardwaffe aufwerten: Stufe 2, Schaden ×1,25', g.weaponLevels.pistol === 2 && g.stats.weaponDamage.pistol === 1.25 && g.offers.length === 0);
  g.offers = [{ kind: 'weapon', id: 'shotgun', levels: 1 }];
  takeOffer(g, 0);
  check('Neue Waffe kommt auf den zweiten Platz', g.stats.weapons.join() === 'pistol,shotgun' && g.weaponCooldown.length === 2);
  g.offers = [{ kind: 'weapon', id: 'grenade', levels: 2 }];
  const text = describeOffer(g, g.offers[0]);
  takeOffer(g, 0);
  check('Weitere Waffe ersetzt die gefundene, nie die Standardwaffe; Boss-Beute bringt Stufe 2',
    g.stats.weapons.join() === 'pistol,grenade' && g.weaponLevels.grenade === 2 && g.weaponLevels.shotgun === undefined
    && text.tag.includes('ersetzt Schrot'), { weapons: g.stats.weapons, tag: text.tag });
}
{
  const g = quiet();
  const before = { ...g.stats };
  for (const id of ['magnet', 'plating', 'longdash'] as const) {
    g.offers = [{ kind: 'module', id, levels: 1 }];
    takeOffer(g, 0);
  }
  g.offers = [{ kind: 'module', id: 'plating', levels: 1 }];
  takeOffer(g, 0);
  check('Module wirken und steigen in der Stufe', g.modules.length === 3 && g.stats.pickup === before.pickup + 40
    && Math.abs(g.stats.damageTaken - 0.7) < 1e-9 && Math.abs(g.stats.dashTime - before.dashTime * 1.3) < 1e-9,
    { pickup: g.stats.pickup, damageTaken: g.stats.damageTaken });
  const offers = Array.from({ length: 40 }, () => rollOffers(g, 1)).flat();
  check('Bei vollen Modul-Plätzen kommen keine neuen Module, nur Stufen',
    offers.every((o) => o.kind === 'weapon' || g.modules.some((m) => m.id === o.id)) && offers.length === 120);
  add(g, 'hunter', 20);
  run(g, 0.5);
  check('Panzerung Stufe 2: 15 Schaden werden zu 11', g.hp === 100 - 11, { hp: g.hp });
}
{
  const g = quiet();
  g.hp = 50;
  g.pickups.push({ x: g.x + 200, y: g.y, kind: 'heal', t: 12 }, { x: g.x, y: g.y + 300, kind: 'heal', t: 0.5 });
  run(g, 1, () => ({ moveX: 1 }));
  check('Heilung: aufheben gibt 20 Trefferpunkte, liegengelassene verfällt', g.hp === 70 && g.pickups.length === 0, { hp: g.hp, pickups: g.pickups.length });
  g.hp = g.stats.maxHp;
  g.pickups.push({ x: g.x, y: g.y, kind: 'heal', t: 12 });
  run(g, 0.2);
  check('Heilung bleibt liegen, solange die Figur voll ist', g.pickups.length === 1);
  let drops = 0;
  for (let i = 0; i < 300; i++) {
    const t = quiet(baseStats(), 6);
    t.turrets.push({ x: 400, y: 30, hp: 0, cooldown: 9, hitFlash: 0, dashHit: false });
    run(t, 0.02);
    drops += t.pickups.length;
  }
  check('Zerstörte Geschütze lassen in etwa 60 % der Fälle Heilung fallen', drops > 140 && drops < 220, { drops });
}

console.log('--- Neue Waffen ---');
{
  const shot = (duck: boolean) => {
    const g = quiet(baseStats({ weapons: ['sniper'] }));
    const e = add(g, 'heavy', 300);
    if (duck) run(g, 0.05, () => ({ duck: true }));
    run(g, 0.4, () => ({ fire: true, duck }));
    return e.hp;
  };
  check('Präzisionsgewehr: 70 Schaden, geduckt 105', shot(false) === 90 && shot(true) === 55, { stand: shot(false), duck: shot(true) });
}
{
  const g = quiet(baseStats({ weapons: ['flamer'] }));
  const near = add(g, 'heavy', 90);
  const far = add(g, 'gunner', 330); // hält von sich aus Abstand
  run(g, 1, () => ({ fire: true, duck: true }));
  check('Flammenwerfer: Dauerschaden auf kurze Distanz, darüber hinaus nichts', near.hp < 130 && far.hp === 30, { near: near.hp, far: far.hp });
}
{
  const g = quiet(baseStats({ weapons: ['chain'] }));
  const [a, b, c] = [add(g, 'heavy', 150), add(g, 'heavy', 150, 110), add(g, 'heavy', 150, 220)];
  run(g, 0.2, () => ({ fire: true, duck: true }));
  check('Kettenblitz: springt weiter, jeder Sprung 30 % schwächer',
    a.hp === 138 && Math.abs(b.hp - 144.6) < 0.01 && Math.abs(c.hp - 149.22) < 0.01 && g.arcs.length > 0, { a: a.hp, b: b.hp, c: c.hp });
}
{
  const g = quiet(baseStats({ weapons: ['pulse'] }));
  g.x = g.prevX = 560;
  const e = add(g, 'hunter', 120);
  step(g, idle(g, { fire: true }));
  run(g, 0.5);
  check('Impulskanone: schleudert weg, Aufprall an der Wand zählt', e.hp === 40 - 4 - 30, { hp: e.hp, x: Math.round(e.x) });
}
{
  const g = quiet(baseStats({ weapons: ['saw'] }));
  g.x = g.prevX = 560;
  const e = add(g, 'heavy', 120);
  run(g, 0.05, () => ({ fire: true, duck: true }));
  run(g, 1.2);
  check('Sägeblatt: geht hindurch, prallt ab und trifft auf dem Rückweg erneut', e.hp === 160 - 56, { hp: e.hp });
}

console.log('--- Neue Module ---');
{
  const withModule = (id: Parameters<typeof takeOffer>[1] extends never ? never : string, levels = 1, stats = baseStats()) => {
    const g = quiet(stats);
    g.offers = [{ kind: 'module', id: id as never, levels }];
    takeOffer(g, 0);
    return g;
  };
  {
    const g = withModule('doublejump');
    step(g, idle(g, { jump: true }));
    run(g, 0.3);
    step(g, idle(g, { jump: true }));
    run(g, 0.3);
    const stillUp = g.air > 0;
    step(g, idle(g, { jump: true }));
    run(g, 0.3);
    check('Doppelsprung: ein zweiter Sprung in der Luft, kein dritter', stillUp && g.air <= 0);
  }
  {
    const slide = (g: Game) => {
      run(g, 0.4, () => ({ moveX: 1 }));
      const from = g.x;
      run(g, 2.5, () => ({ duck: true }));
      return g.x - from;
    };
    const plain = quiet();
    plain.x = plain.prevX = 60;
    const g = withModule('slider');
    g.x = g.prevX = 60;
    const e = add(g, 'heavy', 190);
    const [short, long] = [slide(plain), slide(g)];
    check('Gleitschuhe: Slide reicht weiter und macht 15 Schaden', long > short * 1.3 && e.hp === 145, { short: Math.round(short), long: Math.round(long), hp: e.hp });
  }
  {
    const g = withModule('shieldgen');
    g.guard = g.stats.guard;
    g.streak = 3;
    g.streakTimer = 4;
    add(g, 'hunter', 20);
    run(g, 0.5); // erster Schlag nach 0,35 s
    const first = { hp: g.hp, streak: g.streak };
    run(g, 0.9); // Erholen 0,5 s, Ausholen 0,35 s, zweiter Schlag
    check('Schildgenerator: fängt den ersten Treffer ab, der zweite sitzt', first.hp === 100 && first.streak === 3 && g.hp === 85, { first, hp: g.hp });
  }
  {
    const g = withModule('blastkick');
    g.x = g.prevX = 650;
    const kicked = add(g, 'hunter', 40);
    const bystander = add(g, 'heavy', 115, 60); // neben der Flugbahn, aber im Sprengradius an der Wand
    step(g, idle(g, { kick: true }));
    run(g, 0.4);
    check('Sprengkick: Aufprall löst eine Explosion aus, die Umstehende trifft, die Figur nicht',
      bystander.hp === 135 && g.hp === 100 && kicked.hp <= 0,
      { bystander: bystander.hp, kicked: kicked.hp, hp: g.hp });
  }
  {
    const chainTo = (g: Game) => {
      g.x = g.prevX = 100;
      add(g, 'hunter', 40);
      const second = add(g, 'hunter', 130);
      step(g, idle(g, { kick: true }));
      run(g, 0.6);
      return second.x - g.x;
    };
    const [plain, boosted] = [chainTo(quiet()), chainTo(withModule('chainreaction'))];
    check('Kettenreaktion: der getroffene Gegner fliegt weiter', boosted > plain + 20, { plain: Math.round(plain), boosted: Math.round(boosted) });
  }
  {
    const g = withModule('quickdraw');
    step(g, idle(g, { fire: true }));
    const cooling = g.weaponCooldown[0];
    step(g, idle(g, { dash: true }));
    check('Schnellzieher: Dash macht die Waffe sofort wieder bereit', cooling > 0 && g.weaponCooldown[0] === 0);
  }
  {
    const g = withModule('adrenaline');
    g.streak = 10;
    g.streakTimer = 9;
    run(g, 0.5, () => ({ moveX: 1 }));
    check('Adrenalin: bei voller Serie 20 % schneller', Math.abs(g.vx - 360) < 0.5, { vx: g.vx });
  }
  {
    const g = withModule('ricochet');
    g.x = g.prevX = 700;
    const behind = add(g, 'hunter', -150);
    behind.angle = 0;
    run(g, 0.05, () => ({ fire: true, duck: true }));
    run(g, 0.5, () => ({ duck: true }));
    check('Querschläger: der Schuss prallt von der Wand ab und trifft hinter der Figur', behind.hp === 20, { hp: behind.hp });
  }
}

console.log('--- Drop-Vorrat ---');
{
  const save = defaultSave();
  const offered = (s: typeof save) => {
    const g = quiet(statsFrom(s));
    return new Set(Array.from({ length: 200 }, () => rollOffers(g, 1)).flat().map((o) => o.id));
  };
  const before = offered(save);
  save.coins = 2000;
  const bought = buyUnlock(save, 'saw') && buyUnlock(save, 'blastkick') && !buyUnlock(save, 'saw') && !buyUnlock(save, 'pistol');
  const after = offered(save);
  check('Gesperrte Waffen und Module tauchen erst nach dem Freischalten als Beute auf',
    bought && save.coins === 500 && !before.has('saw') && !before.has('blastkick') && after.has('saw') && after.has('blastkick') && !after.has('sniper'),
    { coins: save.coins, before: [...before].length, after: [...after].length });
  check('Freigeschaltetes übersteht Speichern und Laden', sanitize(JSON.parse(JSON.stringify(save))).unlocked.join() === 'saw,blastkick');
}

console.log('--- Shop und Charaktere ---');
{
  const save = defaultSave();
  const basics = statsFrom(save);
  check('Start nur mit dem Agenten und seiner Pistole', basics.character === 'agent' && basics.weapons.join() === 'pistol'
    && basics.dashCharges === 1 && basics.extraLives === 0 && basics.stillSpread === 0);
  check('Ohne Guthaben kein Kauf', !buyUpgrade(save, 'speed') && !buyCharacter(save, 'cyborg') && !selectCharacter(save, 'cyborg'));
  save.coins = 5000;
  const bought = buyUpgrade(save, 'speed') && buyCharacter(save, 'biker');
  check('Kaufen zieht Guthaben ab und wählt den Charakter', bought && save.coins === 5000 - 150 - 2000 && save.character === 'biker'
    && !buyCharacter(save, 'biker'), { coins: save.coins, character: save.character });
  const biker = statsFrom(save);
  check('Biker: Schrot, mehr Trefferpunkte, langsamer, stärkerer Kick', biker.weapons.join() === 'shotgun' && biker.maxHp === 130
    && biker.speed === Math.round(315 * 0.9) && biker.kickForce === 2000, biker);
  const stats = (id: 'cyborg' | 'punk') => statsFrom({ ...defaultSave(), characters: ['agent', id], character: id });
  const cyborg = stats('cyborg');
  const punk = stats('punk');
  check('Cyborg: Schwerlaser, zwei Dash-Ladungen, weniger Trefferpunkte', cyborg.weapons.join() === 'rail' && cyborg.dashCharges === 2 && cyborg.maxHp === 80);
  check('Punk: MP, schneller, längere Serie', punk.weapons.join() === 'smg' && punk.speed === 336 && punk.streakTime === 6 && punk.maxHp === 75);
  check('Zurück zum Agenten wechseln', selectCharacter(save, 'agent') && statsFrom(save).weapons.join() === 'pistol');
  const back = sanitize(JSON.parse(JSON.stringify(save)));
  check('Speicherstand übersteht Speichern und Laden', JSON.stringify(back) === JSON.stringify(save));
  const old = sanitize({
    coins: 700, upgrades: { speed: 99 }, weapons: { pistol: 0, shotgun: 2 }, modules: ['magnet'],
    sets: [{ primary: 'shotgun', secondary: null, modules: ['magnet'] }], character: 'punk', characters: ['x'],
  });
  check('Alter Speicherstand: Guthaben und Upgrades bleiben, Waffen, Module und Sets fallen weg',
    old.coins === 700 && old.upgrades.speed === 5 && old.character === 'agent' && old.characters.join() === 'agent'
    && !('weapons' in old) && !('modules' in old) && !('sets' in old), old);
}
{
  const g = quiet(baseStats({ weapons: ['smg'] }));
  run(g, 1, () => ({ fire: true }));
  check('MP: etwa elf Schüsse pro Sekunde', g.bullets.length + 0 >= 0 && Math.abs(g.events.filter((e) => e === 'shoot').length - 11) <= 1,
    { shots: g.events.filter((e) => e === 'shoot').length });
}

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
