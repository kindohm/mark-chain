/**
 * Sequencer types
 */

export interface SequencerConfig {
    bpm: number;
    numStates: number;
}

export interface SequencerState {
    currentState: number;
    isRunning: boolean;
    stepCount: number;
    config: SequencerConfig;
}

export interface StateTransitionEvent {
    fromState: number;
    toState: number;
    step: number;
    timestamp: number;
}
