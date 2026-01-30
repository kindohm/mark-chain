/**
 * Sequencer types
 */

/**
 * Sequencer configuration
 */
export interface SequencerConfig {
    /** Tempo in BPM */
    bpm: number;
    /** Number of states */
    numStates: number;
}

/**
 * Sequencer state
 */
export interface SequencerState {
    /** Current state in the Markov chain */
    currentState: number;
    /** Is the sequencer running */
    isRunning: boolean;
    /** Current step count */
    stepCount: number;
    /** Configuration */
    config: SequencerConfig;
}

/**
 * Event emitted when state transitions
 */
export interface StateTransitionEvent {
    /** Previous state */
    fromState: number;
    /** New state */
    toState: number;
    /** Step number */
    step: number;
    /** Timestamp */
    timestamp: number;
}
