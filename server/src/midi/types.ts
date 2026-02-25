/**
 * MIDI types and channel mapping
 */

export interface MidiDevice {
    name: string;
}

/** Per-state MIDI routing config */
export interface StateMidiConfig {
    deviceName: string;
    /** 1-indexed MIDI channel (1–16). Converted to 0-indexed when sent to easymidi. */
    channel: number;
}

export interface MidiNoteEvent {
    channel: number;
    note: number;
    velocity: number;
    duration?: number;
}

export interface MidiConfig {
    /** MIDI note to play (default: 36) */
    note: number;
    /** Velocity (default: 100) */
    velocity: number;
    /** Note duration in ms (default: 100) */
    noteDuration: number;
    /** Total number of states — last state is a rest */
    numStates: number;
}

/**
 * Map a state index to a 0-indexed MIDI channel.
 * Last state produces a rest (returns null).
 * States 0..N-2 → channels 0..N-2 (0-indexed, as required by easymidi).
 */
export function stateToChannel(stateIndex: number, numStates: number): number | null {
    if (isRestState(stateIndex, numStates)) return null;
    return stateIndex;
}

/** The last state index is a rest — no MIDI note fired */
export function isRestState(stateIndex: number, numStates: number): boolean {
    return stateIndex === numStates - 1;
}
