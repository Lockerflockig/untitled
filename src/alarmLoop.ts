// Zeitlogik der Dauertöne (etwa der Warnton der Sprengdrohne), getrennt vom Ton selbst:
// Sie kennt weder AudioContext noch DOM und lässt sich deshalb ohne Browser prüfen.
// src/audio.ts führt die Befehle aus.

import type { Alarm, AlarmKind } from './sim/types.ts';

/** Sekunden zwischen zwei Pieptönen: ruhig → höchste Dringlichkeit. */
export const ALARM_INTERVAL: [number, number] = [0.7, 0.14];

const intervalFor = (urgency: number) => ALARM_INTERVAL[0] + (ALARM_INTERVAL[1] - ALARM_INTERVAL[0]) * Math.min(1, Math.max(0, urgency));

export interface AlarmCommand {
  kind: AlarmKind;
  action: 'beep' | 'stop'; // beep: jetzt einmal ertönen lassen; stop: sofort beenden, was dieser Ton noch spielt
  urgency: number;
}

/**
 * Hält fest, welche Dauertöne laufen. Pro Aufruf kommt die Liste der Töne, die jetzt
 * laufen sollen; zurück kommt, was zu tun ist: ein Ton, der neu in der Liste steht,
 * piept sofort; solange er bleibt, piept er im Takt seiner Dringlichkeit; fällt er aus
 * der Liste, endet er sofort.
 *
 * @param loops ob der Ton als Schleife läuft. Wenn nicht, ertönt er nur einmal, wenn er angeht.
 */
export class AlarmLoops {
  // Art → wann sie zuletzt gepiept hat und ob sie als Schleife läuft
  private running = new Map<AlarmKind, { at: number; loops: boolean }>();

  update(active: Alarm[], now: number, loops: (kind: AlarmKind) => boolean): AlarmCommand[] {
    const commands: AlarmCommand[] = [];
    for (const kind of [...this.running.keys()]) {
      if (active.some((a) => a.kind === kind)) continue;
      this.running.delete(kind);
      commands.push({ kind, action: 'stop', urgency: 0 });
    }
    for (const alarm of active) {
      const state = this.running.get(alarm.kind);
      // Läuft schon: ohne Schleife nie wieder, sonst erst, wenn der Takt dieser Dringlichkeit vorbei ist.
      // Steigt die Dringlichkeit, kommt der nächste Piepton dadurch früher.
      if (state && (!state.loops || now - state.at < intervalFor(alarm.urgency))) continue;
      this.running.set(alarm.kind, { at: now, loops: state ? state.loops : loops(alarm.kind) });
      commands.push({ kind: alarm.kind, action: 'beep', urgency: alarm.urgency });
    }
    return commands;
  }
}
