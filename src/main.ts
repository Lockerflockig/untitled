import { ARENA, STEP } from './sim/types.ts';
import type { CharacterId, Game, Input, Level, ModuleId, WeaponId } from './sim/types.ts';
import { levelOf, streakMultiplier } from './sim/core.ts';
import { newGame, step } from './sim/game.ts';
import {
  CHARACTERS, CHARACTER_IDS, MODULES, UNLOCKS, UPGRADES, WEAPONS,
  buyCharacter, buyUnlock, buyUpgrade, loadSave, persist, selectCharacter, statsFrom, upgradeCost,
} from './sim/meta.ts';
import { describeOffer, takeOffer } from './sim/loot.ts';
import type { UpgradeId } from './sim/meta.ts';
import { VIEW, WALL, draw } from './render.ts';
import { initAudio, play, setAlarms, toggleMute } from './audio.ts';
import { alarmsOf } from './sim/enemies.ts';

type Screen = 'menu' | 'shop' | 'chars' | 'playing' | 'paused' | 'loot' | 'over';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d')!;
const overlay = $('overlay');
const hud = {
  hpBar: $('hp-bar'), hpText: $('hp-text'), lives: $('lives'),
  room: $('room'), objective: $('objective'),
  score: $('score'), multiplier: $('multiplier'), level: $('level'),
  dashes: $('dashes'), kickBar: $('kick-bar'), weapon: $('weapon'), modules: $('modules'),
};
const ROMAN = ['', 'I', 'II', 'III'];
const LEVEL_NAME: Record<Level, string> = { low: 'Boden', mid: 'Mitte', high: 'Oben' };

// Zum Testen: ?raum=6 startet direkt in Raum 6. Solche Runs werden nicht gutgeschrieben.
const TEST_ROOM = Math.max(1, Math.floor(Number(new URLSearchParams(location.search).get('raum')) || 1));

const save = loadSave();
// Zum Testen: ?punkte=20000 schreibt einmalig Guthaben gut. Der Zusatz wird danach
// aus der Adresse entfernt, damit ein Neuladen nicht noch einmal gutschreibt.
const testCoins = Math.floor(Number(new URLSearchParams(location.search).get('punkte')) || 0);
if (testCoins > 0) {
  save.coins += testCoins;
  persist(save);
  const url = new URL(location.href);
  url.searchParams.delete('punkte');
  history.replaceState(null, '', url);
}
// Zum Testen: ?charakter=cyborg spielt einen Charakter, ohne ihn zu kaufen. Der
// Speicherstand bleibt davon unberührt – nur die Werte für den Run werden so berechnet.
const param = new URLSearchParams(location.search).get('charakter') as CharacterId | null;
const TEST_CHARACTER = param && CHARACTER_IDS.includes(param) ? param : null;
const runStats = () => statsFrom(TEST_CHARACTER ? { ...save, character: TEST_CHARACTER } : save);

let screen: Screen = 'menu';
let game: Game = newGame(runStats(), TEST_ROOM);
let banked = true; // ob die Punkte des aktuellen Runs schon gutgeschrieben sind

// --- Eingabe --------------------------------------------------------------

const keys = new Set<string>();
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
const mouse = { x: ARENA / 2, y: ARENA / 2, fire: false };
const queued = { dash: false, jump: false, kick: false, swap: false };
// Ducken liegt auf C statt Strg: Strg+W schließt den Browser-Tab, und das lässt
// sich von einer Webseite aus nicht abfangen.
const DUCK_KEY = 'KeyC';

window.addEventListener('keydown', (e) => {
  const playing = screen === 'playing';
  if (MOVE_KEYS.includes(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  } else if (e.code === 'Space') {
    if (playing && !e.repeat) queued.jump = true;
    e.preventDefault();
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (playing && !e.repeat) queued.dash = true;
  } else if (e.code === 'KeyQ') {
    if (playing && !e.repeat) queued.swap = true;
  } else if (e.code === DUCK_KEY) {
    keys.add(e.code);
  } else if (screen === 'loot' && /^(Digit|Numpad)[1-9]$/.test(e.code)) {
    pickOffer(Number(e.code.slice(-1)) - 1);
  } else if (e.code === 'KeyM') {
    if (!e.repeat) toggleMute();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    if (playing) setScreen('paused');
    else if (screen === 'paused') setScreen('playing');
    else if (screen === 'shop' || screen === 'chars') setScreen('menu');
  } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
    if (screen === 'paused') setScreen('playing');
    else if (screen === 'menu' || screen === 'over') start();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  // Das Bild zeigt den Raum samt Wänden; die Mausposition wird auf Raum-Koordinaten umgerechnet
  mouse.x = ((e.clientX - rect.left) / rect.width) * VIEW - WALL;
  mouse.y = ((e.clientY - rect.top) / rect.height) * VIEW - WALL;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.fire = true;
  else if (e.button === 2 && screen === 'playing') queued.kick = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.fire = false;
});
canvas.addEventListener('wheel', (e) => {
  if (screen === 'playing') queued.swap = true;
  e.preventDefault();
}, { passive: false });
// Die rechte Maustaste kickt und soll kein Kontextmenü öffnen
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function releaseAll() {
  keys.clear();
  mouse.fire = false;
  queued.dash = queued.jump = queued.kick = queued.swap = false;
}
window.addEventListener('blur', () => {
  releaseAll();
  if (screen === 'playing') setScreen('paused');
});

const held = (...codes: string[]) => (codes.some((c) => keys.has(c)) ? 1 : 0);

// --- Run starten und beenden ------------------------------------------------

function start() {
  initAudio(); // Browser erlauben Ton erst nach einer Nutzeraktion
  game = newGame(runStats(), TEST_ROOM);
  banked = TEST_ROOM > 1;
  releaseAll();
  setScreen('playing');
}

/** Schreibt die Punkte des Runs gut – genau einmal, egal wie er endet. */
function bankRun() {
  if (banked) return;
  banked = true;
  save.coins += game.score;
  save.bestScore = Math.max(save.bestScore, game.score);
  save.bestRoom = Math.max(save.bestRoom, game.room);
  persist(save);
}

// --- Bildschirme ----------------------------------------------------------

function setScreen(next: Screen) {
  screen = next;
  render();
  overlay.querySelector<HTMLElement>('.primary')?.focus();
}

function render() {
  overlay.innerHTML = overlayHtml();
  overlay.classList.toggle('wide', screen === 'shop' || screen === 'chars');
}

const CONTROLS = `<p class="keys">WASD: bewegen · Maus: zielen · Linksklick: schießen · Rechtsklick: Kick<br>
  Shift: Dash · Leertaste: springen · C: ducken, aus dem Lauf sliden · Q / Mausrad: Waffe wechseln · M: Ton an/aus · Esc: Pause</p>`;
const wallet = () => `<p class="wallet">Guthaben: <b>${save.coins}</b> Punkte</p>`;
const pips = (level: number, max: number) => '●'.repeat(level) + '○'.repeat(max - level);

function overlayHtml(): string {
  switch (screen) {
    case 'playing':
      return '';
    case 'menu':
      return `
        <h1>Escape the Beams</h1>
        <p class="rule">Erfülle die Aufgabe des Raums, dann öffnet sich der Ausgang. Schieß, <b>dashe</b> durch
          Gegner und <b>kicke</b> sie in Wände, Laser und einander – je stilvoller, desto mehr Punkte.
          Punkte sind dein Guthaben im Shop.</p>
        ${wallet()}
        <button class="primary" data-action="start">Spielen</button>
        <div class="row">
          <button data-action="chars">Charakter: ${CHARACTERS[TEST_CHARACTER ?? save.character].name}</button>
          <button data-action="shop">Shop</button>
        </div>
        <p class="keys">Bestwert: ${save.bestScore} Punkte · Raum ${save.bestRoom}</p>
        ${CONTROLS}`;
    case 'paused':
      return `
        <h1>Pause</h1>
        <div class="row">
          <button class="primary" data-action="resume">Weiter</button>
          <button data-action="quit">Run beenden</button>
        </div>
        ${CONTROLS}`;
    case 'over':
      return `
        <h1>Zerstört</h1>
        <div class="final">${game.score}</div>
        <p class="rule">Raum ${game.room} · ${game.kills} Gegner besiegt · ${game.time.toFixed(0)} s</p>
        ${wallet()}
        <div class="row">
          <button class="primary" data-action="start">Nochmal</button>
          <button data-action="shop">Shop</button>
          <button data-action="menu">Menü</button>
        </div>`;
    case 'shop':
      return shopHtml();
    case 'chars':
      return charsHtml();
    case 'loot':
      return lootHtml();
  }
}

const item = (attr: string, name: string, detail: string, price: number | null, extra = '') => `
  <button class="item" ${attr} ${price === null || price > save.coins ? 'disabled' : ''}>
    <span class="name">${name}${extra}</span>
    <span class="detail">${detail}</span>
    <span class="cost">${price === null ? '–' : price}</span>
  </button>`;

function shopHtml(): string {
  const groups = [...new Set(UPGRADES.map((u) => u.group))].map((group) => `
    <h2>${group}</h2>
    ${UPGRADES.filter((u) => u.group === group).map((u) => {
      const level = save.upgrades[u.id];
      const maxed = level >= u.max;
      const detail = maxed ? u.format(u.value(level)) : `${u.format(u.value(level))} → ${u.format(u.value(level + 1))}`;
      return item(`data-upgrade="${u.id}"`, u.name, detail, maxed ? null : upgradeCost(u, level), ` <i>${pips(level, u.max)}</i>`);
    }).join('')}`).join('');

  return `
    <h1>Shop</h1>
    ${wallet()}
    <div class="shop">
      ${groups}
      <h2>Drop-Vorrat</h2>
      <p class="keys left">Waffen und Module findest du im Run. Was du hier freischaltest, kann dort als Beute auftauchen.</p>
      ${UNLOCKS.map((u) => {
        const owned = save.unlocked.includes(u.id);
        const def = u.kind === 'weapon' ? WEAPONS[u.id as WeaponId] : MODULES[u.id as ModuleId];
        const kind = u.kind === 'weapon' ? 'Waffe' : 'Modul';
        return item(`data-unlock="${u.id}"`, def.name, `${kind} · ${def.desc}${owned ? ' · im Vorrat' : ''}`, owned ? null : u.cost);
      }).join('')}
    </div>
    <div class="row">
      <button data-action="chars">Charaktere</button>
      <button class="primary" data-action="menu">Zurück</button>
    </div>`;
}

/** Was die Figur in diesem Run schon gefunden hat. */
function loadoutText(): string {
  const weapons = game.stats.weapons.map((id) => `${WEAPONS[id].name} ${ROMAN[game.weaponLevels[id] ?? 1]}`);
  const modules = game.modules.map((m) => `${MODULES[m.id].name} ${ROMAN[m.level]}`);
  return [...weapons, ...modules].join(' · ');
}

/** Beute nach einem geschafften Raum: eines von drei Dingen. */
function lootHtml(): string {
  const cards = game.offers.map((offer, i) => {
    const d = describeOffer(game, offer);
    return `
      <button class="item loot" data-offer="${i}">
        <span class="name">${i + 1} · ${d.title}<small>${offer.kind === 'weapon' ? 'Waffe' : 'Modul'}</small></span>
        <span class="detail">${d.detail}</span>
        <span class="cost">${d.tag}</span>
      </button>`;
  }).join('');
  return `
    <h1>Beute</h1>
    <p class="rule">Raum ${game.room} geschafft. Wähle eines – es gilt für den Rest des Runs.</p>
    <div class="shop">${cards}</div>
    <p class="keys">Du hast: ${loadoutText()}<br>Tasten 1 bis ${game.offers.length} oder klicken</p>`;
}

function pickOffer(index: number) {
  if (!takeOffer(game, index)) return;
  releaseAll();
  setScreen('playing');
}

/** Charakterwahl: Jeder bringt seine Standardwaffe, eine Eigenheit und eigene Grundwerte mit. */
function charsHtml(): string {
  const cards = CHARACTER_IDS.map((id) => {
    const c = CHARACTERS[id];
    const owned = save.characters.includes(id);
    const selected = save.character === id;
    const detail = `${WEAPONS[c.weapon].name} · ${c.trait} · ${c.profile}`;
    if (!owned) return item(`data-character="${id}"`, c.name, detail, c.cost);
    return `
      <button class="item ${selected ? 'selected' : ''}" data-character="${id}">
        <span class="name">${c.name}</span>
        <span class="detail">${detail}</span>
        <span class="cost">${selected ? 'gewählt' : 'wählen'}</span>
      </button>`;
  }).join('');
  return `
    <h1>Charaktere</h1>
    ${wallet()}
    <p class="rule">Der gewählte Charakter gilt für den nächsten Run.</p>
    <div class="shop">${cards}</div>
    <div class="row">
      <button data-action="shop">Shop</button>
      <button class="primary" data-action="menu">Zurück</button>
    </div>`;
}

overlay.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest('button');
  if (!button) return;
  const d = button.dataset;

  if (d.offer) return pickOffer(Number(d.offer));
  if (d.action === 'start') return start();
  if (d.action === 'resume') return setScreen('playing');
  if (d.action === 'quit') {
    bankRun();
    return setScreen('over');
  }
  if (d.action === 'menu' || d.action === 'shop' || d.action === 'chars') return setScreen(d.action);

  if (d.upgrade) buyUpgrade(save, d.upgrade as UpgradeId);
  else if (d.unlock) buyUnlock(save, d.unlock as WeaponId | ModuleId);
  else if (d.character) {
    const id = d.character as CharacterId;
    if (!selectCharacter(save, id)) buyCharacter(save, id);
  } else return;
  persist(save);
  // Im Hintergrund steht schon die Figur, mit der der nächste Run startet
  if (screen !== 'paused') game = newGame(runStats(), TEST_ROOM);
  render();
});

// --- HUD ------------------------------------------------------------------

function objectiveText(): string {
  if (game.phase !== 'play') return 'Zum Ausgang ➜';
  const { objective, goal } = game.plan;
  const done = Math.min(goal, Math.floor(game.progress));
  switch (objective) {
    case 'collect': return `Bananen ${done} / ${goal}`;
    case 'clear': return `Säubern ${done} / ${goal}`;
    case 'survive': return `Überleben ${Math.ceil(goal - game.progress)} s`;
    case 'destroy': return `Geschütze ${done} / ${goal}`;
    case 'boss': return 'Boss besiegen';
  }
}

function updateHud() {
  const s = game.stats;
  hud.hpBar.style.width = `${(game.hp / s.maxHp) * 100}%`;
  hud.hpText.textContent = String(Math.max(0, game.hp));
  hud.lives.textContent = game.lives > 0 ? ` +${game.lives} Leben` : '';
  hud.room.textContent = `Raum ${game.room}`;
  hud.objective.textContent = objectiveText();
  hud.score.textContent = String(game.score);
  hud.multiplier.textContent = `×${(streakMultiplier(game) * game.plan.multiplier).toFixed(1)}`;
  hud.multiplier.classList.toggle('active', game.streak > 0);
  hud.level.textContent = game.sliding ? 'Boden (Slide)' : LEVEL_NAME[levelOf(game)];
  hud.dashes.textContent = pips(game.dashes, s.dashCharges);
  hud.kickBar.style.width = `${(1 - game.kickCooldown / s.kickCooldown) * 100}%`;
  hud.kickBar.classList.toggle('ready', game.kickCooldown <= 0);
  const weaponId = s.weapons[game.weapon];
  hud.weapon.textContent = `${WEAPONS[weaponId].name} ${ROMAN[game.weaponLevels[weaponId] ?? 1]}`;
  hud.modules.textContent = game.modules.map((m) => `${MODULES[m.id].name} ${ROMAN[m.level]}`).join(' · ');
}

// --- Schleife: feste Simulationsschritte, Rendering pro Bildschirm-Frame ---

function resize() {
  const size = Math.round(canvas.clientWidth * window.devicePixelRatio);
  if (canvas.width !== size) canvas.width = canvas.height = size;
}

let last = performance.now();
let accumulator = 0;

function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); // nach Tab-Wechsel nicht nachholen
  last = now;

  if (screen === 'playing') {
    accumulator += dt;
    const input: Input = {
      moveX: held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft'),
      moveY: held('KeyS', 'ArrowDown') - held('KeyW', 'ArrowUp'),
      aimX: mouse.x,
      aimY: mouse.y,
      fire: mouse.fire,
      duck: keys.has(DUCK_KEY),
      ...queued,
    };
    while (accumulator >= STEP) {
      step(game, input);
      // ein Tastendruck löst genau eine Aktion aus
      input.dash = input.jump = input.kick = input.swap = false;
      queued.dash = queued.jump = queued.kick = queued.swap = false;
      accumulator -= STEP;
    }
    for (const event of new Set(game.events)) play(event);
    game.events.length = 0;
    if (game.offers.length > 0) setScreen('loot');
    if (game.over) {
      bankRun();
      setScreen('over');
    }
  }
  // Dauertöne laufen nur im Spiel; jeder andere Bildschirm beendet sie sofort
  setAlarms(screen === 'playing' ? alarmsOf(game) : []);

  resize();
  draw(ctx, game, screen === 'playing' ? accumulator / STEP : 1, canvas.width, now / 1000);
  updateHud();
  requestAnimationFrame(frame);
}

setScreen('menu');
requestAnimationFrame(frame);
