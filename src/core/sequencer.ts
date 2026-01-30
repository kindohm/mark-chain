/**
 * Sequencer for managing timing and state transitions
 */

import { MarkovMatrix, type StateName } from './markov.js';

export interface SequencerConfig {
    tempo: number; // BPM
    onStateChange?: (state: StateName) => void;
}

export class Sequencer {
    private matrix: MarkovMatrix;
    private currentState: StateName;
    private tempo: number;
    private isRunning: boolean;
    private intervalId: NodeJS.Timeout | null;
    private onStateChange?: (state: StateName) => void;

    constructor(matrix: MarkovMatrix, config: SequencerConfig) {
        this.matrix = matrix;
        this.tempo = config.tempo;
        this.onStateChange = config.onStateChange;
        this.isRunning = false;
        this.intervalId = null;

        // Start at first state
        const states = matrix.getStates();
        this.currentState = states[0];
    }

    /**
     * Start the sequencer
     */
    start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.scheduleNextStep();
    }

    /**
     * Stop the sequencer
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Set the tempo in BPM
     */
    setTempo(bpm: number): void {
        if (bpm <= 0) {
            throw new Error('Tempo must be positive');
        }
        this.tempo = bpm;
    }

    /**
     * Get the current tempo
     */
    getTempo(): number {
        return this.tempo;
    }

    /**
     * Get the current state
     */
    getCurrentState(): StateName {
        return this.currentState;
    }

    /**
     * Check if sequencer is running
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Get the Markov matrix
     */
    getMatrix(): MarkovMatrix {
        return this.matrix;
    }

    /**
     * Schedule the next step
     * Treats each step as a 16th note (4 steps per beat)
     */
    private scheduleNextStep(): void {
        if (!this.isRunning) {
            return;
        }

        // Calculate interval in milliseconds
        // Multiply tempo by 4 to treat events as 16th notes
        const effectiveTempo = this.tempo * 4;
        const intervalMs = (60 / effectiveTempo) * 1000;

        this.intervalId = setTimeout(() => {
            this.step();
            this.scheduleNextStep();
        }, intervalMs);
    }

    /**
     * Execute one step: transition to next state and notify
     */
    private step(): void {
        // Transition to next state
        this.currentState = this.matrix.getNextState(this.currentState);

        // Notify listener
        if (this.onStateChange) {
            this.onStateChange(this.currentState);
        }
    }
}
