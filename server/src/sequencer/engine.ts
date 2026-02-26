/**
 * Sequencer engine — Markov chain state machine with timing
 */

import type { Matrix } from '../matrix/types.js';
import type { SequencerConfig, SequencerState, StateTransitionEvent } from './types.js';

/**
 * Select next state based on cumulative probability distribution
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

    // Fallback (should never happen with a normalized row)
    return row.length - 1;
}

/**
 * Calculate step duration in milliseconds from BPM (16th note timing)
 */
export function bpmToMs(bpm: number): number {
    return (60 * 1000) / bpm / 4;
}

export class SequencerEngine {
    private state: SequencerState;
    private matrix: Matrix;
    private timerId: NodeJS.Timeout | null = null;
    private onTransition: ((event: StateTransitionEvent) => void) | null = null;
    private readonly externalClock: boolean;

    constructor(matrix: Matrix, config: (Partial<SequencerConfig> & { externalClock?: boolean }) = {}) {
        this.matrix = matrix;
        this.externalClock = config.externalClock ?? false;
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

    onStateTransition(callback: (event: StateTransitionEvent) => void): void {
        this.onTransition = callback;
    }

    start(): void {
        if (this.state.isRunning) return;
        this.state.isRunning = true;
        if (!this.externalClock) this.scheduleNextStep();
    }

    stop(): void {
        this.state.isRunning = false;
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    reset(): void {
        this.stop();
        this.state.currentState = 0;
        this.state.stepCount = 0;
    }

    /**
     * If currentState is out of range for a new numStates, reset it to 0.
     * Does NOT stop the sequencer.
     */
    clampCurrentState(max: number): void {
        if (this.state.currentState >= max) {
            this.state.currentState = 0;
        }
    }

    updateMatrix(matrix: Matrix): void {
        this.matrix = matrix;
    }

    updateConfig(config: Partial<SequencerConfig>): void {
        this.state.config = { ...this.state.config, ...config };
    }

    getState(): SequencerState {
        return { ...this.state };
    }

    getCurrentState(): number {
        return this.state.currentState;
    }

    isRunning(): boolean {
        return this.state.isRunning;
    }

    tick(): void {
        if (!this.state.isRunning) return;
        this.executeStep();
    }

    private scheduleNextStep(): void {
        if (!this.state.isRunning) return;
        if (this.externalClock) return;
        const stepDuration = bpmToMs(this.state.config.bpm);
        this.timerId = setTimeout(() => {
            this.executeStep();
            this.scheduleNextStep();
        }, stepDuration);
    }

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
