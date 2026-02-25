/**
 * MIDI types and interfaces
 */

/**
 * MIDI device information
 */
export interface MidiDevice {
    name: string;
    manufacturer?: string;
}

/**
 * MIDI note event
 */
export interface MidiNoteEvent {
    channel: number;
    note: number;
    velocity: number;
    duration?: number;
}

/**
 * Configuration for MIDI mapping
 */
export interface MidiConfig {
    /** MIDI note to play (default: 36 = C1) */
    note: number;
    /** Velocity for note on events (default: 100) */
    velocity: number;
    /** Note duration in milliseconds (default: 100) */
    noteDuration: number;
    /** Number of states in the system */
    numStates: number;
}

/**
 * State to MIDI channel mapping
 * Last state produces rests (no MIDI output)
 */
export function stateToChannel(stateIndex: number, numStates: number): number | null {
    // Last state is a rest
    if (stateIndex === numStates - 1) {
        return null;
    }

    // States 0..N-2 map to MIDI channels 1..N-1
    // (MIDI channels are 1-indexed in most contexts, but 0-indexed in easymidi)
    return stateIndex;
}

/**
 * Check if a state produces a rest (no MIDI output)
 */
export function isRestState(stateIndex: number, numStates: number): boolean {
    return stateIndex === numStates - 1;
}
