// Loot im Run: Auswahl nach jedem geschafften Raum (Waffen und Module mit
// Stufen) und Drops aus zerstörten Gegenständen. Alles hier gilt nur für den
// laufenden Run.

import { STEP } from './types.ts';
import type { Game, ModuleId, Offer, Pickup, Stats, WeaponId } from './types.ts';
import { PLAYER_R } from './core.ts';
import { MODULES, MODULE_IDS, WEAPONS, WEAPON_IDS } from './meta.ts';

export const MAX_LEVEL = 3;
export const MODULE_SLOTS = 3;
export const OFFER_COUNT = 3;
const WEAPON_DAMAGE_PER_LEVEL = 0.25;

export const PICKUP_R = 12;
const PICKUP_LIFE = 12; // so lange bleibt ein Drop liegen
const HEAL_AMOUNT = 20;

/** Wirkung eines Moduls je Stufe. */
export const MODULE_LEVELS: Record<ModuleId, { text: string[]; apply: (s: Stats, level: number) => void }> = {
  magnet: {
    text: ['+40 px Aufheb-Reichweite', '+70 px Aufheb-Reichweite', '+100 px Aufheb-Reichweite'],
    apply: (s, l) => {
      s.pickup += [40, 70, 100][l - 1];
    },
  },
  longdash: {
    text: ['Dash reicht 30 % weiter', 'Dash reicht 50 % weiter', 'Dash reicht 70 % weiter'],
    apply: (s, l) => {
      s.dashTime *= [1.3, 1.5, 1.7][l - 1];
    },
  },
  heavyboot: {
    text: ['Kick mit 25 % mehr Wucht', 'Kick mit 40 % mehr Wucht', 'Kick mit 55 % mehr Wucht'],
    apply: (s, l) => {
      s.kickForce *= [1.25, 1.4, 1.55][l - 1];
    },
  },
  steady: {
    text: ['Keine Streuung im Stand', 'Dazu 25 % weniger Streuung in Bewegung', 'Dazu 50 % weniger Streuung in Bewegung'],
    apply: (s, l) => {
      s.stillSpread = 0;
      s.spread *= [1, 0.75, 0.5][l - 1];
    },
  },
  plating: {
    text: ['20 % weniger Schaden', '30 % weniger Schaden', '40 % weniger Schaden'],
    apply: (s, l) => {
      s.damageTaken *= [0.8, 0.7, 0.6][l - 1];
    },
  },
  combo: {
    text: ['Serie hält 2 s länger', 'Serie hält 3,5 s länger', 'Serie hält 5 s länger'],
    apply: (s, l) => {
      s.streakTime += [2, 3.5, 5][l - 1];
    },
  },
  doublejump: {
    text: ['Ein zweiter Sprung in der Luft, mit Richtungswechsel', 'Zwei weitere Sprünge in der Luft', 'Drei weitere Sprünge in der Luft'],
    apply: (s, l) => {
      s.airJumps += l;
    },
  },
  slider: {
    text: ['Slide reicht 40 % weiter und macht 15 Schaden', 'Slide reicht 80 % weiter und macht 25 Schaden', 'Slide reicht 150 % weiter und macht 35 Schaden'],
    apply: (s, l) => {
      s.slideFriction *= [0.7, 0.55, 0.4][l - 1];
      s.slideDamage = [15, 25, 35][l - 1];
    },
  },
  chainreaction: {
    text: ['Domino gibt den vollen Schwung weiter, 30 % mehr Aufprallschaden', 'Domino verstärkt den Schwung, 60 % mehr Aufprallschaden', 'Domino verstärkt den Schwung deutlich, doppelter Aufprallschaden'],
    apply: (s, l) => {
      s.transfer = [1, 1.1, 1.2][l - 1];
      s.impact *= [1.3, 1.6, 2][l - 1];
    },
  },
  blastkick: {
    text: ['Gekickte Gegner explodieren beim Aufprall (klein)', 'Gekickte Gegner explodieren beim Aufprall (mittel)', 'Gekickte Gegner explodieren beim Aufprall (groß)'],
    apply: (s, l) => {
      s.kickBlast = [50, 65, 80][l - 1];
      s.kickBlastDamage = [25, 35, 45][l - 1];
    },
  },
  shieldgen: {
    text: ['Fängt einen Treffer pro Raum ab', 'Fängt zwei Treffer pro Raum ab', 'Fängt drei Treffer pro Raum ab'],
    apply: (s, l) => {
      s.guard += l;
    },
  },
  adrenaline: {
    text: ['2 % schneller je Kill in der Serie (bis 10)', '3 % schneller je Kill in der Serie (bis 10)', '4 % schneller je Kill in der Serie (bis 10)'],
    apply: (s, l) => {
      s.streakSpeed = [0.02, 0.03, 0.04][l - 1];
    },
  },
  ricochet: {
    text: ['Schüsse prallen einmal von der Wand ab', 'Schüsse prallen zweimal von der Wand ab', 'Schüsse prallen dreimal von der Wand ab'],
    apply: (s, l) => {
      s.bounces += l;
    },
  },
  quickdraw: {
    text: ['Ein Dash setzt die Abklingzeit der Waffe zurück', 'Ein Dash setzt auch die Abklingzeit des Kicks zurück', 'Dazu lädt der Dash 30 % schneller nach'],
    apply: (s, l) => {
      s.quickdraw = l;
      if (l >= 3) s.dashRecharge *= 0.7;
    },
  },
};

const standardWeapon = (g: Game) => g.baseStats.weapons[0];
const holds = (g: Game, id: WeaponId) => id === standardWeapon(g) || id === g.found;

/** Rechnet die Werte der Figur aus Grundwerten, Waffenstufen und Modulen neu aus. */
export function applyLoadout(g: Game) {
  const s: Stats = { ...g.baseStats, weaponDamage: { ...g.baseStats.weaponDamage } };
  s.weapons = g.found ? [standardWeapon(g), g.found] : [standardWeapon(g)];
  for (const id of s.weapons) s.weaponDamage[id] = 1 + WEAPON_DAMAGE_PER_LEVEL * ((g.weaponLevels[id] ?? 1) - 1);
  for (const m of g.modules) MODULE_LEVELS[m.id].apply(s, m.level);
  g.stats = s;
  g.weaponCooldown = s.weapons.map((_, i) => g.weaponCooldown[i] ?? 0);
  g.weapon = Math.min(g.weapon, s.weapons.length - 1);
}

/**
 * Würfelt die Auswahl nach einem Raum. Zur Wahl stehen: höhere Stufen für das,
 * was man hat, neue Waffen (ersetzen die gefundene Zweitwaffe, nie die
 * Standardwaffe) und neue Module, solange ein Platz frei ist.
 * @param levels wie viele Stufen ein Angebot bringt – nach einem Boss zwei
 */
export function rollOffers(g: Game, levels: number): Offer[] {
  // Neues kommt nur aus dem Vorrat; was man schon hat, lässt sich immer aufwerten
  const pool: Offer[] = [];
  const inPool = (id: WeaponId | ModuleId) => g.baseStats.pool.includes(id);
  for (const id of WEAPON_IDS) {
    if (holds(g, id) ? (g.weaponLevels[id] ?? 1) < MAX_LEVEL : inPool(id)) pool.push({ kind: 'weapon', id, levels });
  }
  for (const id of MODULE_IDS) {
    const held = g.modules.find((m) => m.id === id);
    if (held ? held.level < MAX_LEVEL : inPool(id) && g.modules.length < MODULE_SLOTS) pool.push({ kind: 'module', id, levels });
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, OFFER_COUNT);
}

/** Nimmt ein Angebot an. Danach geht der Raum weiter zum Ausgang. */
export function takeOffer(g: Game, index: number) {
  const offer = g.offers[index];
  if (!offer) return false;
  if (offer.kind === 'weapon') {
    const id = offer.id as WeaponId;
    if (holds(g, id)) {
      g.weaponLevels[id] = Math.min(MAX_LEVEL, (g.weaponLevels[id] ?? 1) + offer.levels);
    } else {
      if (g.found) delete g.weaponLevels[g.found];
      g.found = id;
      g.weaponLevels[id] = Math.min(MAX_LEVEL, offer.levels);
    }
  } else {
    const id = offer.id as ModuleId;
    const held = g.modules.find((m) => m.id === id);
    if (held) held.level = Math.min(MAX_LEVEL, held.level + offer.levels);
    else g.modules.push({ id, level: Math.min(MAX_LEVEL, offer.levels) });
  }
  g.offers = [];
  g.events.push('pickup');
  applyLoadout(g);
  return true;
}

/** Beschriftung eines Angebots für die Auswahl. */
export function describeOffer(g: Game, offer: Offer): { title: string; detail: string; tag: string } {
  if (offer.kind === 'weapon') {
    const id = offer.id as WeaponId;
    const w = WEAPONS[id];
    if (holds(g, id)) {
      const from = g.weaponLevels[id] ?? 1;
      const to = Math.min(MAX_LEVEL, from + offer.levels);
      return {
        title: w.name,
        detail: `Schaden ×${(1 + WEAPON_DAMAGE_PER_LEVEL * (to - 1)).toFixed(2)}`,
        tag: `Stufe ${from} → ${to}`,
      };
    }
    const level = Math.min(MAX_LEVEL, offer.levels);
    return {
      title: w.name,
      detail: w.desc,
      tag: (g.found ? `ersetzt ${WEAPONS[g.found].name}` : 'neue Zweitwaffe') + (level > 1 ? ` · Stufe ${level}` : ''),
    };
  }
  const id = offer.id as ModuleId;
  const held = g.modules.find((m) => m.id === id);
  const to = Math.min(MAX_LEVEL, (held?.level ?? 0) + offer.levels);
  return {
    title: MODULES[id].name,
    detail: MODULE_LEVELS[id].text[to - 1],
    tag: held ? `Stufe ${held.level} → ${to}` : `neues Modul${to > 1 ? ` · Stufe ${to}` : ''}`,
  };
}

// --- Drops aus zerstörten Gegenständen -----------------------------------------

export type DropSource = 'barrel' | 'mine' | 'turret';

/** Was ein zerstörter Gegenstand fallen lassen kann. Vorerst nur Heilung. */
const DROPS: Record<DropSource, { kind: Pickup['kind']; chance: number }[]> = {
  barrel: [{ kind: 'heal', chance: 0.35 }],
  mine: [{ kind: 'heal', chance: 0.15 }],
  turret: [{ kind: 'heal', chance: 0.6 }],
};

export function dropFrom(g: Game, source: DropSource, x: number, y: number) {
  for (const entry of DROPS[source]) {
    if (Math.random() < entry.chance) {
      g.pickups.push({ x, y, kind: entry.kind, t: PICKUP_LIFE });
      return;
    }
  }
}

export function stepPickups(g: Game) {
  g.pickups = g.pickups.filter((p) => {
    p.t -= STEP;
    if (p.t <= 0) return false;
    if (Math.hypot(p.x - g.x, p.y - g.y) >= PLAYER_R + PICKUP_R + g.stats.pickup) return true;
    // Heilung bleibt liegen, solange die Figur voll ist
    if (g.hp >= g.stats.maxHp) return true;
    const healed = Math.min(HEAL_AMOUNT, g.stats.maxHp - g.hp);
    g.hp += healed;
    g.popups.push({ x: p.x, y: p.y, text: `+${healed} TP`, t: 0.9 });
    g.events.push('pickup');
    return false;
  });
}
