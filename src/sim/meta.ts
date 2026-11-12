// Alles, was zwischen den Runs bleibt: Waffen, Module, Upgrades, Ausrüstungs-Sets
// und der Speicherstand. Die Zahlen hier sind die Stellschrauben fürs Balancing.

import type { ModuleId, Stats, WeaponId } from './types.ts';

// --- Waffen -----------------------------------------------------------------

export interface WeaponDef {
  name: string;
  desc: string;
  cost: number; // Freischalt-Preis
  cooldown: number;
  spread: number; // ± rad
  duckSpread: number; // Faktor auf die Streuung beim Ducken
  pellets: number;
  damage: number; // je Projektil
  speed: number;
  life: number; // Flugdauer
  pierce: boolean;
  blast: number; // Explosionsradius
  multi: boolean; // kann mit einem Schuss mehrere treffen → zählt als Aktion für den Mehrfach-Aufschlag
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    name: 'Pistole', desc: 'Einzelschüsse, mittlere Rate', cost: 0,
    cooldown: 0.3, spread: 0.03, duckSpread: 0, pellets: 1, damage: 20, speed: 900, life: 2,
    pierce: false, blast: 0, multi: false,
  },
  shotgun: {
    name: 'Schrot', desc: 'Fächer, stark auf kurze Distanz', cost: 800,
    cooldown: 0.8, spread: 0.24, duckSpread: 0.6, pellets: 6, damage: 9, speed: 800, life: 0.4,
    pierce: false, blast: 0, multi: true,
  },
  rail: {
    name: 'Durchschuss', desc: 'Langsam, durchschlägt alle in einer Linie', cost: 1200,
    cooldown: 1.1, spread: 0.01, duckSpread: 0, pellets: 1, damage: 45, speed: 1800, life: 2,
    pierce: true, blast: 0, multi: true,
  },
  grenade: {
    name: 'Granate', desc: 'Landet am Fadenkreuz, Flächenschaden', cost: 1500,
    cooldown: 1.2, spread: 0.04, duckSpread: 0.3, pellets: 1, damage: 50, speed: 520, life: 1.3,
    pierce: false, blast: 90, multi: true,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const WEAPON_MAX_LEVEL = 3;
export const weaponUpgradeCost = (level: number) => Math.round(400 * 1.7 ** level);
export const weaponDamageFactor = (level: number) => 1 + 0.2 * level;

// --- Module (passive Effekte für die Set-Plätze) ------------------------------

export const MODULES: Record<ModuleId, { name: string; desc: string; cost: number }> = {
  magnet: { name: 'Magnet', desc: '+40 px Aufheb-Reichweite', cost: 500 },
  longdash: { name: 'Nachbrenner', desc: 'Dash reicht 30 % weiter', cost: 700 },
  heavyboot: { name: 'Schwerer Stiefel', desc: 'Kick mit 25 % mehr Wucht', cost: 700 },
  steady: { name: 'Ruhige Hand', desc: 'Keine Streuung im Stand', cost: 500 },
  plating: { name: 'Panzerung', desc: '20 % weniger Schaden', cost: 900 },
  combo: { name: 'Taktgeber', desc: 'Serie hält 2 s länger', cost: 600 },
};
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];
export const MODULE_SLOTS = 2;

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

export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId | null;
  modules: ModuleId[];
}

export interface Save {
  coins: number;
  bestScore: number;
  bestRoom: number;
  upgrades: Record<UpgradeId, number>;
  weapons: Partial<Record<WeaponId, number>>; // freigeschaltete Waffen mit Stufe
  modules: ModuleId[]; // freigeschaltete Module
  sets: Loadout[];
  activeSet: number;
}

export const SET_COUNT = 3;

/** Neuer Spielstand: nur die Basics – Pistole, ein Dash, Kick. */
export function defaultSave(): Save {
  const upgrades = {} as Record<UpgradeId, number>;
  for (const def of UPGRADES) upgrades[def.id] = 0;
  return {
    coins: 0,
    bestScore: 0,
    bestRoom: 0,
    upgrades,
    weapons: { pistol: 0 },
    modules: [],
    sets: Array.from({ length: SET_COUNT }, () => ({ primary: 'pistol' as WeaponId, secondary: null, modules: [] })),
    activeSet: 0,
  };
}

/** Übernimmt gespeicherte Werte nur, soweit sie gültig sind. */
export function sanitize(stored: unknown): Save {
  const save = defaultSave();
  if (!stored || typeof stored !== 'object') return save;
  const s = stored as Partial<Save>;
  const int = (v: unknown, max = Infinity) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));
  save.coins = int(s.coins);
  save.bestScore = int(s.bestScore);
  save.bestRoom = int(s.bestRoom);
  for (const def of UPGRADES) save.upgrades[def.id] = int(s.upgrades?.[def.id], def.max);
  for (const id of WEAPON_IDS) {
    if (s.weapons && id in s.weapons) save.weapons[id] = int(s.weapons[id], WEAPON_MAX_LEVEL);
  }
  save.weapons.pistol ??= 0;
  save.modules = MODULE_IDS.filter((m) => Array.isArray(s.modules) && s.modules.includes(m));
  const owned = (id: unknown): id is WeaponId => typeof id === 'string' && id in save.weapons;
  save.sets = save.sets.map((fallback, i) => {
    const set = Array.isArray(s.sets) ? s.sets[i] : undefined;
    if (!set) return fallback;
    const primary = owned(set.primary) ? set.primary : 'pistol';
    return {
      primary,
      secondary: owned(set.secondary) && set.secondary !== primary ? set.secondary : null,
      modules: save.modules.filter((m) => Array.isArray(set.modules) && set.modules.includes(m)).slice(0, MODULE_SLOTS),
    };
  });
  save.activeSet = int(s.activeSet, SET_COUNT - 1);
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

/** Schaltet eine Waffe frei oder stuft eine vorhandene hoch. */
export function buyWeapon(save: Save, id: WeaponId) {
  const level = save.weapons[id];
  if (level === undefined) {
    if (!pay(save, WEAPONS[id].cost)) return false;
    save.weapons[id] = 0;
    return true;
  }
  if (level >= WEAPON_MAX_LEVEL || !pay(save, weaponUpgradeCost(level))) return false;
  save.weapons[id] = level + 1;
  return true;
}

export function buyModule(save: Save, id: ModuleId) {
  if (save.modules.includes(id) || !pay(save, MODULES[id].cost)) return false;
  save.modules.push(id);
  return true;
}

// --- Werte für einen Run ----------------------------------------------------

export function statsFrom(save: Save): Stats {
  const value = (id: UpgradeId) => UPGRADES.find((u) => u.id === id)!.value(save.upgrades[id]);
  const set = save.sets[save.activeSet];
  const has = (m: ModuleId) => set.modules.includes(m);
  const weaponDamage = {} as Record<WeaponId, number>;
  for (const id of WEAPON_IDS) weaponDamage[id] = weaponDamageFactor(save.weapons[id] ?? 0);
  return {
    speed: value('speed'),
    pickup: value('pickup') + (has('magnet') ? 40 : 0),
    maxHp: value('maxHp'),
    extraLives: value('lives'),
    dashCharges: value('dashCharges'),
    dashIframes: value('dashIframes'),
    dashRecharge: value('dashRecharge'),
    dashDamage: value('dashDamage'),
    dashTime: 0.11 * (has('longdash') ? 1.3 : 1),
    kickForce: value('kickForce') * (has('heavyboot') ? 1.25 : 1),
    kickCooldown: value('kickCooldown'),
    impact: value('impact'),
    damageTaken: has('plating') ? 0.8 : 1,
    stillSpread: has('steady') ? 0 : 1,
    streakTime: 4 + (has('combo') ? 2 : 0),
    weapons: set.secondary ? [set.primary, set.secondary] : [set.primary],
    weaponDamage,
  };
}
