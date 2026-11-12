// Platzhalter-Sounds, per Code erzeugt. Alle Waffen teilen sich vorerst einen Schuss-Sound.
//
// Eigene Sounds: Datei nach public/sounds/ legen und in public/sounds/sounds.json
// eintragen, z. B. { "shoot": "pistole.wav", "explode": "boom.ogg" }. Ein
// eingetragener Sound ersetzt den Platzhalter; alles andere bleibt, wie es ist.

import type { GameEvent } from './sim/types.ts';

const VOLUME = 0.25;
const MIN_GAP = 0.04; // derselbe Sound höchstens alle 40 ms
const MUTE_KEY = 'etb-muted';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* ohne Speicher startet der Ton eingeschaltet */
}
const custom = new Map<GameEvent, AudioBuffer>();
const lastPlayed = new Map<GameEvent, number>();

/** Ton mit Frequenzverlauf von f0 nach f1. */
function tone(type: OscillatorType, f0: number, f1: number, duration: number, gain: number, delay = 0) {
  if (!ac || !master) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + duration);
}

/** Rauschen durch einen Tiefpass, dessen Grenzfrequenz von f0 nach f1 fährt. */
function noise(f0: number, f1: number, duration: number, gain: number) {
  if (!ac || !master) return;
  const t = ac.currentTime;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + duration);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
}

const SYNTH: Record<GameEvent, () => void> = {
  shoot: () => tone('square', 880, 220, 0.08, 0.35),
  dash: () => noise(4000, 600, 0.16, 0.5),
  kick: () => {
    tone('sine', 160, 45, 0.14, 1);
    noise(2500, 400, 0.05, 0.5);
  },
  jump: () => tone('sine', 300, 620, 0.1, 0.4),
  slide: () => noise(1200, 300, 0.28, 0.3),
  hit: () => tone('square', 320, 260, 0.03, 0.3),
  kill: () => tone('square', 600, 1200, 0.09, 0.4),
  hurt: () => tone('sawtooth', 220, 70, 0.22, 0.6),
  explode: () => {
    noise(900, 80, 0.45, 1);
    tone('sine', 90, 30, 0.35, 0.8);
  },
  pickup: () => {
    tone('sine', 880, 880, 0.07, 0.4);
    tone('sine', 1320, 1320, 0.1, 0.4, 0.07);
  },
  roomClear: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.16, 0.5, i * 0.09)),
  die: () => tone('sawtooth', 300, 35, 0.7, 0.7),
};

/** Muss aus einer Nutzeraktion heraus aufgerufen werden (Browser erlauben Ton erst dann). */
export function initAudio() {
  if (ac) {
    void ac.resume();
    return;
  }
  ac = new AudioContext();
  master = ac.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ac.destination);
  void loadCustomSounds(ac);
}

async function loadCustomSounds(context: AudioContext) {
  try {
    const list = (await (await fetch('sounds/sounds.json')).json()) as Partial<Record<GameEvent, string>>;
    for (const [event, file] of Object.entries(list)) {
      if (!(event in SYNTH) || typeof file !== 'string') continue;
      try {
        const data = await (await fetch(`sounds/${file}`)).arrayBuffer();
        custom.set(event as GameEvent, await context.decodeAudioData(data));
      } catch {
        console.warn(`Sound "${file}" für "${event}" ließ sich nicht laden – Platzhalter bleibt.`);
      }
    }
  } catch {
    /* keine sounds.json – es bleibt bei den Platzhaltern */
  }
}

export function play(event: GameEvent) {
  if (!ac || !master) return;
  const now = ac.currentTime;
  if (now - (lastPlayed.get(event) ?? -1) < MIN_GAP) return;
  lastPlayed.set(event, now);
  const buffer = custom.get(event);
  if (buffer) {
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(master);
    src.start();
  } else {
    SYNTH[event]();
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : VOLUME;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* dann gilt es nur für diese Sitzung */
  }
  return muted;
}
