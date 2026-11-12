// Platzhalter-Sounds, per Code erzeugt. Alle Waffen teilen sich vorerst einen Schuss-Sound.
//
// Eigene Sounds: Datei nach public/sounds/ legen und in public/sounds/sounds.json
// eintragen, z. B. { "shoot": "pistole.wav", "explode": "boom.ogg" }. Ein
// eingetragener Sound ersetzt den Platzhalter; alles andere bleibt, wie es ist.
//
// Dauertöne (Warnton der Sprengdrohne, Name "beep") laufen als Schleife, solange ihre
// Bedingung gilt. Statt eines Dateinamens lässt sich ein Objekt eintragen, um die
// Schleife auszuschalten: { "beep": { "datei": "piep.wav", "schleife": false } } –
// dann ertönt der Ton nur einmal, wenn er angeht.

import { AlarmLoops } from './alarmLoop.ts';
import type { Alarm, AlarmKind, GameEvent } from './sim/types.ts';

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
const custom = new Map<string, AudioBuffer>();
const lastPlayed = new Map<GameEvent, number>();
const loopSetting = new Map<string, boolean>(); // je Ton aus sounds.json: läuft er als Schleife?
const alarmLoops = new AlarmLoops();
const sounding = new Map<AlarmKind, Set<AudioScheduledSourceNode>>(); // was von einem Dauerton gerade klingt, damit „stop" es sofort beendet

/** Ton mit Frequenzverlauf von f0 nach f1. */
function tone(type: OscillatorType, f0: number, f1: number, duration: number, gain: number, delay = 0) {
  if (!ac || !master) return undefined;
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
  return osc;
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
  charge: () => tone('sawtooth', 180, 900, 0.35, 0.25),
  beam: () => {
    tone('sawtooth', 140, 60, 0.25, 0.6);
    noise(6000, 800, 0.2, 0.5);
  },
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

/** Platzhalter für Dauertöne; je dringlicher, desto höher (die Taktung kommt aus alarmLoop.ts). */
const ALARM_SYNTH: Record<AlarmKind, (urgency: number) => AudioScheduledSourceNode | undefined> = {
  beep: (urgency) => {
    const f = 740 + 560 * urgency;
    return tone('square', f, f, 0.09, 0.3);
  },
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

type SoundEntry = string | { datei?: string; schleife?: boolean };

async function loadCustomSounds(context: AudioContext) {
  try {
    const list = (await (await fetch('sounds/sounds.json')).json()) as Record<string, SoundEntry>;
    for (const [name, entry] of Object.entries(list)) {
      if (!(name in SYNTH) && !(name in ALARM_SYNTH)) continue;
      const file = typeof entry === 'string' ? entry : entry?.datei;
      // Die Schleife lässt sich auch für den Platzhalter ausschalten, ganz ohne eigene Datei
      if (entry && typeof entry === 'object' && typeof entry.schleife === 'boolean') loopSetting.set(name, entry.schleife);
      if (typeof file !== 'string') continue;
      try {
        const data = await (await fetch(`sounds/${file}`)).arrayBuffer();
        custom.set(name, await context.decodeAudioData(data));
      } catch {
        console.warn(`Sound "${file}" für "${name}" ließ sich nicht laden – Platzhalter bleibt.`);
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

/** Einen Piepton eines Dauertons spielen; eine eigene Datei klingt mit der Dringlichkeit schneller und höher. */
function beep(kind: AlarmKind, urgency: number) {
  if (!ac || !master) return;
  const buffer = custom.get(kind);
  let src: AudioScheduledSourceNode | undefined;
  if (buffer) {
    const file = ac.createBufferSource();
    file.buffer = buffer;
    file.playbackRate.value = 1 + 0.5 * urgency;
    file.connect(master);
    file.start();
    src = file;
  } else {
    src = ALARM_SYNTH[kind](urgency);
  }
  if (!src) return;
  const playing = src;
  const running = sounding.get(kind) ?? new Set<AudioScheduledSourceNode>();
  sounding.set(kind, running);
  running.add(playing);
  playing.onended = () => running.delete(playing);
}

/** Beendet sofort, was von diesem Dauerton noch klingt. */
function silence(kind: AlarmKind) {
  for (const src of sounding.get(kind) ?? []) {
    try {
      src.stop();
    } catch {
      /* war schon zu Ende */
    }
  }
  sounding.get(kind)?.clear();
}

/**
 * Jeden Frame aufrufen: die Dauertöne, die jetzt laufen sollen (außerhalb des Spiels eine
 * leere Liste – dann endet alles sofort, auch bei Pause, Beute-Auswahl und Spielende).
 */
export function setAlarms(active: Alarm[]) {
  if (!ac || !master) return;
  for (const c of alarmLoops.update(active, ac.currentTime, (kind) => loopSetting.get(kind) ?? true)) {
    if (c.action === 'stop') silence(c.kind);
    else beep(c.kind, c.urgency);
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
