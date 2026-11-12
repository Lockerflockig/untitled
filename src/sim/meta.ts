// Alles, was zwischen den Runs bleibt: Charaktere, Upgrades und der Speicherstand.
// Dazu die Waffen- und Modul-Daten. Die Zahlen hier sind die Stellschrauben fürs
// Balancing.

import type { BulletLook, CharacterId, ModuleId, Stats, WeaponId } from './types.ts';

// --- Waffen -----------------------------------------------------------------

export interface WeaponDef {
  name: string;
  desc: string;
  cooldown: number;
  spread: number; // ± rad
  duckSpread: number; // Faktor auf die Streuung beim Ducken
  pellets: number;
  damage: number; // je Projektil
  speed: number;
  life: number; // Flugdauer
  blast: number; // Explosionsradius
  // Strahlenwaffe statt Projektil: Ladezeit, Brenndauer, halbe Breite (s, s, px)
  beam?: { charge: number; duration: number; width: number };
  look?: BulletLook;
  pierce?: boolean; // fliegt durch Gegner hindurch
  bounces?: number; // prallt so oft von der Wand ab
  push?: number; // schleudert Getroffene weg wie ein Kick
  chain?: number; // springt auf so viele weitere Gegner über
  hitR?: number; // zusätzlicher Trefferradius
  duckDamage?: number; // Schadensfaktor beim Ducken
  multi: boolean; // kann mit einem Schuss mehrere treffen → zählt als Aktion für den Mehrfach-Aufschlag
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    name: 'Pistole', desc: 'Einzelschüsse, mittlere Rate',
    cooldown: 0.3, spread: 0.03, duckSpread: 0, pellets: 1, damage: 20, speed: 900, life: 2,
    blast: 0, multi: false,
  },
  smg: {
    name: 'MP', desc: 'Hohe Feuerrate, wenig Schaden, streut',
    cooldown: 0.09, spread: 0.1, duckSpread: 0.4, pellets: 1, damage: 7, speed: 950, life: 1.2,
    blast: 0, multi: false,
  },
  shotgun: {
    name: 'Schrot', desc: 'Fächer, stark auf kurze Distanz',
    cooldown: 0.8, spread: 0.24, duckSpread: 0.6, pellets: 6, damage: 9, speed: 800, life: 0.4,
    blast: 0, multi: true,
  },
  rail: {
    name: 'Schwerlaser', desc: 'Lädt auf, dann brennt ein Strahl durch alle in einer Linie',
    cooldown: 1.6, spread: 0, duckSpread: 0, pellets: 1, damage: 60, speed: 0, life: 0,
    blast: 0, multi: true,
    beam: { charge: 0.35, duration: 0.12, width: 9 },
  },
  grenade: {
    name: 'Granate', desc: 'Landet am Fadenkreuz, Flächenschaden',
    cooldown: 1.2, spread: 0.04, duckSpread: 0.3, pellets: 1, damage: 50, speed: 520, life: 1.3,
    blast: 90, multi: true, look: 'grenade',
  },
  sniper: {
    name: 'Präzisionsgewehr', desc: 'Langsam, viel Schaden, keine Streuung; geduckt 50 % mehr',
    cooldown: 1, spread: 0.004, duckSpread: 0, pellets: 1, damage: 70, speed: 1700, life: 2,
    blast: 0, multi: false, look: 'tracer', duckDamage: 1.5,
  },
  flamer: {
    name: 'Flammenwerfer', desc: 'Kurzer Kegel, Dauerschaden, geht durch Gegner',
    cooldown: 0.05, spread: 0.22, duckSpread: 0.7, pellets: 1, damage: 3, speed: 420, life: 0.38,
    blast: 0, multi: false, look: 'flame', pierce: true, hitR: 8,
  },
  chain: {
    name: 'Kettenblitz', desc: 'Springt vom Ziel auf bis zu drei Gegner in der Nähe über',
    cooldown: 0.55, spread: 0.02, duckSpread: 0, pellets: 1, damage: 22, speed: 1100, life: 1,
    blast: 0, multi: true, look: 'bolt', chain: 3,
  },
  pulse: {
    name: 'Impulskanone', desc: 'Kaum Schaden, schleudert Gegner weg wie ein Kick',
    cooldown: 0.7, spread: 0, duckSpread: 0, pellets: 1, damage: 4, speed: 700, life: 0.6,
    blast: 0, multi: true, look: 'pulse', pierce: true, push: 1100, hitR: 10,
  },
  saw: {
    name: 'Sägeblatt', desc: 'Geht durch Gegner und prallt dreimal von der Wand ab',
    cooldown: 0.9, spread: 0.02, duckSpread: 0, pellets: 1, damage: 28, speed: 620, life: 2.4,
    blast: 0, multi: true, look: 'saw', pierce: true, bounces: 3, hitR: 6,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

// --- Module (passive Effekte; kommen künftig als Drops im Run) ---------------

export const MODULES: Record<ModuleId, { name: string; desc: string }> = {
  magnet: { name: 'Magnet', desc: '+40 px Aufheb-Reichweite' },
  longdash: { name: 'Nachbrenner', desc: 'Dash reicht 30 % weiter' },
  heavyboot: { name: 'Schwerer Stiefel', desc: 'Kick mit 25 % mehr Wucht' },
  steady: { name: 'Ruhige Hand', desc: 'Keine Streuung im Stand' },
  plating: { name: 'Panzerung', desc: '20 % weniger Schaden' },
  combo: { name: 'Taktgeber', desc: 'Serie hält 2 s länger' },
  doublejump: { name: 'Doppelsprung', desc: 'Zweiter Sprung in der Luft, mit Richtungswechsel' },
  slider: { name: 'Gleitschuhe', desc: 'Slide reicht weiter und macht Schaden' },
  chainreaction: { name: 'Kettenreaktion', desc: 'Domino gibt den vollen Schwung weiter und macht mehr Schaden' },
  blastkick: { name: 'Sprengkick', desc: 'Gekickte Gegner explodieren beim Aufprall' },
  shieldgen: { name: 'Schildgenerator', desc: 'Fängt einen Treffer pro Raum ab' },
  adrenaline: { name: 'Adrenalin', desc: 'Schneller, je höher die Serie' },
  ricochet: { name: 'Querschläger', desc: 'Schüsse prallen von der Wand ab' },
  quickdraw: { name: 'Schnellzieher', desc: 'Ein Dash setzt die Abklingzeit der Waffe zurück' },
};
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

// --- Drop-Vorrat ------------------------------------------------------------

/** Was von Anfang an als Beute auftauchen kann. */
export const BASE_POOL: (WeaponId | ModuleId)[] = [
  'pistol', 'smg', 'shotgun', 'rail', 'grenade',
  'magnet', 'longdash', 'heavyboot', 'steady', 'plating', 'combo',
];

/** Alles Übrige schaltet man im Shop für den Vorrat frei. */
export const UNLOCKS: { id: WeaponId | ModuleId; kind: 'weapon' | 'module'; cost: number }[] = [
  ...WEAPON_IDS.filter((id) => !BASE_POOL.includes(id)).map((id) => ({ id, kind: 'weapon' as const, cost: 900 })),
  ...MODULE_IDS.filter((id) => !BASE_POOL.includes(id)).map((id) => ({ id, kind: 'module' as const, cost: 600 })),
];

// --- Charaktere -------------------------------------------------------------

export interface CharacterDef {
  name: string;
  cost: number; // 0 = von Anfang an da
  weapon: WeaponId; // feste Standardwaffe
  trait: string; // Eigenheit, für die Anzeige
  profile: string; // Grundwerte in Worten, für die Anzeige
  /** Wendet Eigenheit und Grundwerte auf die Werte aus den Upgrades an. */
  apply: (s: Stats) => void;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  agent: {
    name: 'Agent', cost: 0, weapon: 'pistol',
    trait: 'Keine Streuung im Stand', profile: 'ausgewogen',
    apply: (s) => {
      s.stillSpread = 0;
    },
  },
  cyborg: {
    name: 'Cyborg', cost: 2500, weapon: 'rail',
    trait: 'Eine Dash-Ladung mehr', profile: '20 % weniger Trefferpunkte',
    apply: (s) => {
      s.dashCharges += 1;
      s.maxHp = Math.round(s.maxHp * 0.8);
    },
  },
  biker: {
    name: 'Biker', cost: 2000, weapon: 'shotgun',
    trait: 'Kick mit 25 % mehr Wucht', profile: '30 % mehr Trefferpunkte, 10 % langsamer',
    apply: (s) => {
      s.kickForce *= 1.25;
      s.maxHp = Math.round(s.maxHp * 1.3);
      s.speed = Math.round(s.speed * 0.9);
    },
  },
  punk: {
    name: 'Punk', cost: 2000, weapon: 'smg',
    trait: 'Serie hält 2 s länger', profile: '12 % schneller, 25 % weniger Trefferpunkte',
    apply: (s) => {
      s.streakTime += 2;
      s.speed = Math.round(s.speed * 1.12);
      s.maxHp = Math.round(s.maxHp * 0.75);
    },
  },
};
export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

// --- Upgrades ---------------------------------------------------------------

export type UpgradeId =
  | 'speed' | 'pickup' | 'maxHp'
  | 'dashCharges' | 'dashIframes' | 'dashRecharge' | 'dashDamage'
  | 'kickForce' | 'kickCooldown' | 'impact'
  | 'lives';

export interface UpgradeDef {
  id: UpgradeId;
  group: 'Figur' | 'Dash' | 'Kick' | 'Leben';
  name: string;
  max: number;
  baseCost: number;
  value: (level: number) => number;
  format: (value: number) => string;
}

const px = (v: number) => `${v} px`;
const sec = (v: number) => `${v.toFixed(2)} s`;

export const UPGRADES: UpgradeDef[] = [
  { id: 'speed', group: 'Figur', name: 'Tempo', max: 5, baseCost: 150, value: (l) => 300 + 15 * l, format: (v) => `${v} px/s` },
  { id: 'pickup', group: 'Figur', name: 'Aufheb-Reichweite', max: 5, baseCost: 120, value: (l) => 10 * l, format: (v) => `+${px(v)}` },
  { id: 'maxHp', group: 'Figur', name: 'Trefferpunkte', max: 5, baseCost: 200, value: (l) => 100 + 20 * l, format: (v) => `${v}` },
  { id: 'dashCharges', group: 'Dash', name: 'Ladungen', max: 2, baseCost: 600, value: (l) => 1 + l, format: (v) => `${v}` },
  { id: 'dashIframes', group: 'Dash', name: 'I-Frames', max: 4, baseCost: 180, value: (l) => 0.25 + 0.04 * l, format: sec },
  { id: 'dashRecharge', group: 'Dash', name: 'Aufladung', max: 4, baseCost: 200, value: (l) => 1.2 - 0.15 * l, format: sec },
  { id: 'dashDamage', group: 'Dash', name: 'Schaden', max: 4, baseCost: 200, value: (l) => 40 + 15 * l, format: (v) => `${v}` },
  { id: 'kickForce', group: 'Kick', name: 'Wucht', max: 4, baseCost: 180, value: (l) => 1600 + 150 * l, format: (v) => `${v} px/s` },
  { id: 'kickCooldown', group: 'Kick', name: 'Abklingzeit', max: 4, baseCost: 180, value: (l) => 0.8 - 0.1 * l, format: sec },
  { id: 'impact', group: 'Kick', name: 'Aufprallschaden', max: 4, baseCost: 220, value: (l) => 1 + 0.25 * l, format: (v) => `×${v.toFixed(2)}` },
  { id: 'lives', group: 'Leben', name: 'Extra-Leben', max: 2, baseCost: 3000, value: (l) => l, format: (v) => `${v}` },
];

export const upgradeCost = (def: UpgradeDef, level: number) => Math.round(def.baseCost * 1.7 ** level);

// --- Speicherstand ----------------------------------------------------------

export interface Save {
  coins: number;
  bestScore: number;
  bestRoom: number;
  upgrades: Record<UpgradeId, number>;
  characters: CharacterId[]; // freigeschaltete Charaktere
  character: CharacterId; // gewählt für den nächsten Run
  unlocked: (WeaponId | ModuleId)[]; // zusätzlich für den Drop-Vorrat freigeschaltet
}

/** Neuer Spielstand: nur der Agent mit seiner Pistole. */
export function defaultSave(): Save {
  const upgrades = {} as Record<UpgradeId, number>;
  for (const def of UPGRADES) upgrades[def.id] = 0;
  return { coins: 0, bestScore: 0, bestRoom: 0, upgrades, characters: ['agent'], character: 'agent', unlocked: [] };
}

/**
 * Übernimmt gespeicherte Werte nur, soweit sie gültig sind. Früher gekaufte
 * Waffen, Module und Sets werden dabei verworfen – sie kommen jetzt über
 * Charaktere und Drops.
 */
export function sanitize(stored: unknown): Save {
  const save = defaultSave();
  if (!stored || typeof stored !== 'object') return save;
  const s = stored as Partial<Save>;
  const int = (v: unknown, max = Infinity) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
  save.coins = int(s.coins);
  save.bestScore = int(s.bestScore);
  save.bestRoom = int(s.bestRoom);
  for (const def of UPGRADES) save.upgrades[def.id] = int(s.upgrades?.[def.id], def.max);
  save.characters = CHARACTER_IDS.filter((id) => id === 'agent' || (Array.isArray(s.characters) && s.characters.includes(id)));
  if (save.characters.includes(s.character as CharacterId)) save.character = s.character as CharacterId;
  save.unlocked = UNLOCKS.map((u) => u.id).filter((id) => Array.isArray(s.unlocked) && s.unlocked.includes(id));
  return save;
}

const KEY = 'etb-save-v2';

export function loadSave(): Save {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return defaultSave(); // kein oder kaputter Speicherstand
  }
}

export function persist(save: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* Speicher nicht verfügbar – Fortschritt gilt dann nur für diese Sitzung */
  }
}

// --- Kaufen -----------------------------------------------------------------

function pay(save: Save, price: number) {
  if (save.coins < price) return false;
  save.coins -= price;
  return true;
}

export function buyUpgrade(save: Save, id: UpgradeId) {
  const def = UPGRADES.find((u) => u.id === id)!;
  const level = save.upgrades[id];
  if (level >= def.max || !pay(save, upgradeCost(def, level))) return false;
  save.upgrades[id]++;
  return true;
}

/** Schaltet einen Charakter frei und wählt ihn aus. */
export function buyCharacter(save: Save, id: CharacterId) {
  if (save.characters.includes(id) || !pay(save, CHARACTERS[id].cost)) return false;
  save.characters.push(id);
  save.character = id;
  return true;
}

/** Nimmt eine Waffe oder ein Modul in den Drop-Vorrat auf. */
export function buyUnlock(save: Save, id: WeaponId | ModuleId) {
  const unlock = UNLOCKS.find((u) => u.id === id);
  if (!unlock || save.unlocked.includes(id) || !pay(save, unlock.cost)) return false;
  save.unlocked.push(id);
  return true;
}

export function selectCharacter(save: Save, id: CharacterId) {
  if (!save.characters.includes(id)) return false;
  save.character = id;
  return true;
}

// --- Werte für einen Run ----------------------------------------------------

export function statsFrom(save: Save): Stats {
  const value = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!.value(save.upgrades[id]);
  const character = CHARACTERS[save.character];
  const weaponDamage = {} as Record<WeaponId, number>;
  for (const id of WEAPON_IDS) weaponDamage[id] = 1;
  const stats: Stats = {
    character: save.character,
    speed: value('speed'),
    pickup: value('pickup'),
    maxHp: value('maxHp'),
    extraLives: value('lives'),
    dashCharges: value('dashCharges'),
    dashIframes: value('dashIframes'),
    dashRecharge: value('dashRecharge'),
    dashDamage: value('dashDamage'),
    dashTime: 0.11,
    kickForce: value('kickForce'),
    kickCooldown: value('kickCooldown'),
    impact: value('impact'),
    damageTaken: 1,
    stillSpread: 1,
    spread: 1,
    streakTime: 4,
    weapons: [character.weapon],
    weaponDamage,
    pool: [...BASE_POOL, ...save.unlocked],
    airJumps: 0,
    slideFriction: 1,
    slideDamage: 0,
    transfer: 0.8,
    kickBlast: 0,
    kickBlastDamage: 0,
    guard: 0,
    streakSpeed: 0,
    bounces: 0,
    quickdraw: 0,
  };
  character.apply(stats);
  return stats;
}
