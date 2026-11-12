// Rechnet die Spielregeln ohne Browser durch. Aufruf: npm test
// (Node ab 22.6, läuft die TypeScript-Dateien direkt.)

import { STEP } from '../src/sim/types.ts';
import type { EnemyKind, Game, Input, Laser, Stats } from '../src/sim/types.ts';
import { newGame, roomPlan, step } from '../src/sim/game.ts';
import { SHIELD_BLAST_RADIUS, SHIELD_TURN, makeEnemy } from '../src/sim/enemies.ts';
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
  run(g, 0.05);
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
{
  const g = quiet();
  const bomber = add(g, 'bomber', 250);
  const near = add(g, 'hunter', 290);
  run(g, 0.4, () => ({ fire: true }));
  check('Abgeschossene Sprengdrohne reißt Nachbarn mit', !g.enemies.includes(bomber) && near.hp <= 0 && g.hp === 100,
    { near: near.hp, hp: g.hp, score: g.score });
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
  const g = newGame(baseStats(), 5);
  g.barrels = [];
  g.laserTimer = g.spawnTimer = 1e9;
  const boss = g.enemies.find((e) => e.kind === 'boss')!;
  const start = boss.x;
  step(g, idle(g, { kick: true, aimX: boss.x, aimY: boss.y }));
  run(g, 4);
  check('Boss: steht im Raum, greift an, lässt sich nicht wegkicken',
    boss.maxHp === 900 && g.shots.length + g.fields.length > 0 && Math.abs(boss.x - start) < 200 && boss.x < start,
    { hp: boss.maxHp, shots: g.shots.length, fields: g.fields.length, moved: Math.round(boss.x - start) });
  boss.hp = 1;
  boss.x = g.x + 150;
  boss.y = g.y;
  run(g, 0.5, (g) => ({ fire: true, duck: true }));
  check('Boss besiegt: 2000 Punkte × Raum-Multiplikator, Ausgang öffnet sich', g.phase === 'exit' && g.kills === 1 && g.score >= 2000 * 2,
    { phase: g.phase, kills: g.kills, score: g.score });
  check('Zweiter Boss hat mehr Trefferpunkte', newGame(baseStats(), 10).enemies[0].maxHp === 1350);
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
  run(g, 0.05);
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
    run(g, 0.05);
    const first = { hp: g.hp, streak: g.streak };
    run(g, 0.7);
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
