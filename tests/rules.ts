// Rechnet die Spielregeln ohne Browser durch. Aufruf: npm test
// (Node ab 22.6, läuft die TypeScript-Dateien direkt.)

import { STEP } from '../src/sim/types.ts';
import type { EnemyKind, Game, Input, Laser, Stats } from '../src/sim/types.ts';
import { newGame, roomPlan, step } from '../src/sim/game.ts';
import { makeEnemy } from '../src/sim/enemies.ts';
import {
  buyModule, buyUpgrade, buyWeapon, defaultSave, sanitize, statsFrom,
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
  check('Schild-Mech blockt Schüsse von vorn, nicht von hinten', front.hp === 60 && back.hp < 60, { front: front.hp, back: back.hp });
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
  check('Durchschuss: tötet zwei in einer Linie, zweiter mit Aufschlag', g.kills === 2 && g.score === 100 + 165, { kills: g.kills, score: g.score });
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

console.log('--- Shop und Sets ---');
{
  const save = defaultSave();
  const basics = statsFrom(save);
  check('Start nur mit Basics', basics.weapons.join() === 'pistol' && basics.dashCharges === 1 && basics.extraLives === 0 && save.modules.length === 0);
  check('Ohne Guthaben kein Kauf', !buyUpgrade(save, 'speed') && !buyWeapon(save, 'shotgun') && !buyModule(save, 'magnet'));
  save.coins = 5000;
  const bought = buyUpgrade(save, 'speed') && buyWeapon(save, 'shotgun') && buyWeapon(save, 'shotgun') && buyModule(save, 'magnet');
  check('Kaufen zieht Guthaben ab', bought && save.coins === 5000 - 150 - 800 - 400 - 500 && save.upgrades.speed === 1 && save.weapons.shotgun === 1,
    { coins: save.coins });
  save.sets[0].secondary = 'shotgun';
  save.sets[0].modules = ['magnet'];
  const stats = statsFrom(save);
  check('Set und Upgrades wirken auf die Werte', stats.weapons.join() === 'pistol,shotgun' && stats.speed === 315 && stats.pickup === 40
    && stats.weaponDamage.shotgun === 1.2, stats);
  const back = sanitize(JSON.parse(JSON.stringify(save)));
  check('Speicherstand übersteht Speichern und Laden', JSON.stringify(back) === JSON.stringify(save));
  const broken = sanitize({ coins: -5, upgrades: { speed: 99 }, sets: [{ primary: 'rail', secondary: 'rail', modules: ['plating', 'x'] }] });
  check('Kaputter Speicherstand wird bereinigt', broken.coins === 0 && broken.upgrades.speed === 5 && broken.sets[0].primary === 'pistol'
    && broken.sets[0].secondary === null && broken.sets[0].modules.length === 0, broken.sets[0]);
}

console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
