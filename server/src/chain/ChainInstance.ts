/**
 * ChainInstance — one independent Markov chain sequencer with per-state MIDI routing
 */

import { SequencerEngine } from '../sequencer/engine.js';
import { DeviceRegistry } from '../midi/DeviceRegistry.js';
import { normalizeMatrix, makeSequentialMatrix } from '../matrix/normalize.js';
import type { Matrix } from '../matrix/types.js';
import type { StateMidiConfig } from '../midi/types.js';
import type { StateTransitionEvent } from '../sequencer/types.js';
import type { ServerMessage } from '../protocol.js';

const MAX_STATES = 8;
const DEFAULT_NOTE = 36;
const DEFAULT_DURATION_MS = 100;

export interface ChainSnapshot {
    chainId: string;
    name: string;
    matrix: Matrix;
    bpm: number;
    numStates: number;
    isEnabled: boolean;
    isRunning: boolean;
    currentState: number;
    stepCount: number;
    stateMidi: StateMidiConfig[];
    midiDevices: string[];
    velocityMin: number[];
}

export interface ChainMidiNoteSentEvent {
    chainId: string;
    deviceName: string;
    channel: number; // 1-indexed
}

export class ChainInstance {
    readonly id: string;
    readonly name: string;

    private rawMatrix: Matrix;
    private numStates: number;
    private engine: SequencerEngine;
    private enabled = true;
    private registry: DeviceRegistry;
    private stateMidi: StateMidiConfig[];
    private velocityMin: number[];
    private onStep: ((msg: ServerMessage) => void) | null = null;
    private onStateChange: (() => void) | null = null;
    private onTransition: ((toState: number) => void) | null = null;
    private onMidiNoteSent: ((event: ChainMidiNoteSentEvent) => void) | null = null;

    constructor(
        id: string,
        name: string,
        bpm: number,
        registry: DeviceRegistry
    ) {
        this.id = id;
        this.name = name;
        this.numStates = MAX_STATES;
        this.rawMatrix = makeSequentialMatrix(MAX_STATES);
        this.registry = registry;

        // Default per-state MIDI: first available device (channels 1..N), last state = rest
        const defaultDevice = registry.findDefaultDevice() ?? '';
        this.stateMidi = Array.from({ length: MAX_STATES }, (_, i) => ({
            deviceName: i === MAX_STATES - 1 ? 'rest' : defaultDevice,
            channel: i + 1,
        }));

        // Default velocity min: 1.0 (no randomness — always max)
        this.velocityMin = Array(MAX_STATES).fill(1.0);

        this.engine = new SequencerEngine(
            this.activeNormalizedMatrix(),
            { bpm, numStates: this.numStates, externalClock: true }
        );

        this.engine.onStateTransition((event: StateTransitionEvent) => {
            this.sendMidiForState(event.toState);

            if (this.onStep) {
                this.onStep({
                    type: 'step',
                    chainId: this.id,
                    fromState: event.fromState,
                    toState: event.toState,
                    step: event.step,
                    timestamp: event.timestamp,
                });
            }

            if (this.onStateChange) this.onStateChange();
            if (this.onTransition) this.onTransition(event.toState);
        });
    }

    onStepEvent(cb: (msg: ServerMessage) => void): void {
        this.onStep = cb;
    }

    onStateChangeEvent(cb: () => void): void {
        this.onStateChange = cb;
    }

    /** Called on every state transition — used by stabs for mirror mode */
    onTransitionEvent(cb: (toState: number) => void): void {
        this.onTransition = cb;
    }

    onMidiNoteSentEvent(cb: (event: ChainMidiNoteSentEvent) => void): void {
        this.onMidiNoteSent = cb;
    }

    start(): void { this.engine.start(); }
    stop(): void { this.engine.stop(); }
    tick16th(): void {
        if (!this.enabled) return;
        this.engine.tick();
    }
    isRunning(): boolean { return this.engine.isRunning(); }

    setCell(row: number, col: number, value: number): void {
        this.rawMatrix[row][col] = value;
        this.engine.updateMatrix(this.activeNormalizedMatrix());
    }

    setBpm(bpm: number): void {
        this.engine.updateConfig({ bpm });
    }

    setNumStates(n: number): void {
        const clamped = Math.max(1, Math.min(MAX_STATES, Math.round(n)));
        this.numStates = clamped;
        this.engine.clampCurrentState(clamped);
        this.engine.updateMatrix(this.activeNormalizedMatrix());
        this.engine.updateConfig({ numStates: clamped });
    }

    setEnabled(isEnabled: boolean): void {
        this.enabled = Boolean(isEnabled);
    }

    setStateMidi(stateIndex: number, config: Partial<StateMidiConfig>): void {
        if (stateIndex < 0 || stateIndex >= MAX_STATES) return;
        this.stateMidi[stateIndex] = { ...this.stateMidi[stateIndex], ...config };
    }

    setVelocityMin(stateIndex: number, value: number): void {
        if (stateIndex < 0 || stateIndex >= MAX_STATES) return;
        this.velocityMin[stateIndex] = Math.max(0, Math.min(1, value));
    }

    getSnapshot(): ChainSnapshot {
        const state = this.engine.getState();
        return {
            chainId: this.id,
            name: this.name,
            matrix: this.rawMatrix.map((row) => [...row]),
            bpm: state.config.bpm,
            numStates: this.numStates,
            isEnabled: this.enabled,
            isRunning: state.isRunning,
            currentState: state.currentState,
            stepCount: state.stepCount,
            stateMidi: this.stateMidi.map((m) => ({ ...m })),
            midiDevices: ['rest', ...this.registry.getAvailableDevices()],
            velocityMin: [...this.velocityMin],
        };
    }

    toStateUpdateMessage(): ServerMessage {
        const snap = this.getSnapshot();
        return {
            type: 'state_update',
            chainId: snap.chainId,
            name: snap.name,
            matrix: snap.matrix,
            bpm: snap.bpm,
            numStates: snap.numStates,
            isEnabled: snap.isEnabled,
            isRunning: snap.isRunning,
            currentState: snap.currentState,
            stepCount: snap.stepCount,
            stateMidi: snap.stateMidi,
            midiDevices: snap.midiDevices,
            velocityMin: snap.velocityMin,
        };
    }

    private sendMidiForState(stateIndex: number): void {
        const config = this.stateMidi[stateIndex];
        if (!config?.deviceName || config.deviceName === 'rest') return;
        const min = this.velocityMin[stateIndex] ?? 1.0;
        // Random velocity in [min, 1.0] scaled to MIDI 0-127
        const velocityNorm = min + Math.random() * (1 - min);
        const velocity = Math.min(127, Math.round(velocityNorm * 127));
        this.registry.sendNote(config.deviceName, config.channel, DEFAULT_NOTE, velocity, DEFAULT_DURATION_MS);
        if (this.onMidiNoteSent) {
            this.onMidiNoteSent({
                chainId: this.id,
                deviceName: config.deviceName,
                channel: config.channel,
            });
        }
    }

    private activeNormalizedMatrix(): Matrix {
        const sub = this.rawMatrix
            .slice(0, this.numStates)
            .map((row) => row.slice(0, this.numStates));
        return normalizeMatrix(sub);
    }
}
