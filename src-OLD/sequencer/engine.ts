/**
 * Sequencer engine - Markov chain state machine with timing
 */

import type { Matrix } from '../matrix/types.js';
import type { SequencerConfig, SequencerState, StateTransitionEvent } from './types.js';

/**
 * Select next state based on probability distribution
 */
export function selectNextState(currentState: number, matrix: Matrix): number {
    const row = matrix[currentState];
    const random = Math.random();

    let cumulative = 0;
    for (let i = 0; i < row.length; i++) {
        cumulative += row[i];
        if (random < cumulative) {
            return i;
        }
    }

    // Fallback (should never happen with normalized rows)
    return row.length - 1;
}

/**
 * Calculate step duration in milliseconds from BPM
 * Events are treated as sixteenth notes (4x speed)
 */
export function bpmToMs(bpm: number): number {
    return (60 * 1000) / bpm / 4;
}

/**
 * Sequencer Engine class
 */
export class SequencerEngine {
    private state: SequencerState;
    private matrix: Matrix;
    private timerId: NodeJS.Timeout | null = null;
    private onTransition: ((event: StateTransitionEvent) => void) | null = null;

    constructor(matrix: Matrix, config: Partial<SequencerConfig> = {}) {
        this.matrix = matrix;
        this.state = {
            currentState: 0,
            isRunning: false,
            stepCount: 0,
            config: {
                bpm: config.bpm ?? 120,
                numStates: config.numStates ?? matrix.length,
            },
        };
    }

    /**
     * Set callback for state transitions
     */
    onStateTransition(callback: (event: StateTransitionEvent) => void): void {
        this.onTransition = callback;
    }

    /**
     * Start the sequencer
     */
    start(): void {
        if (this.state.isRunning) {
            return;
        }

        this.state.isRunning = true;
        this.scheduleNextStep();
    }

    /**
     * Stop the sequencer
     */
    stop(): void {
        this.state.isRunning = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Reset sequencer to initial state
     */
    reset(): void {
        this.stop();
        this.state.currentState = 0;
        this.state.stepCount = 0;
    }

    /**
     * Update the matrix
     */
    updateMatrix(matrix: Matrix): void {
        this.matrix = matrix;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<SequencerConfig>): void {
        this.state.config = { ...this.state.config, ...config };
    }

    /**
     * Get current state
     */
    getState(): SequencerState {
        return { ...this.state };
    }

    /**
     * Get current state index
     */
    getCurrentState(): number {
        return this.state.currentState;
    }

    /**
     * Schedule next step
     */
    private scheduleNextStep(): void {
        if (!this.state.isRunning) {
            return;
        }

        const stepDuration = bpmToMs(this.state.config.bpm);

        this.timerId = setTimeout(() => {
            this.executeStep();
            this.scheduleNextStep();
        }, stepDuration);
    }

    /**
     * Execute a single step
     */
    private executeStep(): void {
        const fromState = this.state.currentState;
        const toState = selectNextState(fromState, this.matrix);

        this.state.currentState = toState;
        this.state.stepCount++;

        if (this.onTransition) {
            this.onTransition({
                fromState,
                toState,
                step: this.state.stepCount,
                timestamp: Date.now(),
            });
        }
    }
}
