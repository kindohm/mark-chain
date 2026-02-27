/**
 * ChainInstance — one independent Markov chain sequencer with per-state MIDI routing
 */

import { SequencerEngine } from '../sequencer/engine.js';
import { DeviceRegistry } from '../midi/DeviceRegistry.js';
import { normalizeMatrix, makeSequentialMatrix } from '../matrix/normalize.js';
import { shiftMatrix as shiftMatrixValues } from '../matrix/shift.js';
import { applyMatrixTransform as applyMatrixTransformValues } from '../matrix/transform.js';
import type { Matrix } from '../matrix/types.js';
import type { StateMidiConfig } from '../midi/types.js';
import type { StateTransitionEvent } from '../sequencer/types.js';
import type { ServerMessage } from '../protocol.js';
import type {
    CycleLength,
    MatrixShiftAlgorithm,
    MatrixTransformAlgorithm,
    MatrixTransformPolarity,
    MatrixTransformState,
} from '../protocol.js';

const MAX_STATES = 8;
const DEFAULT_NUM_STATES = 5;
const DEFAULT_ACTIVE_STATE_CHANNELS = [3, 4, 7, 8] as const;
const DEFAULT_NOTE = 36;
const DEFAULT_DURATION_MS = 100;
const DEFAULT_TRANSFORM_STATE: MatrixTransformState = {
    reciprocalLoops: { amount: 0.35 },
    cycleInject: { amount: 0.35, cycleLength: 3 },
    settle: { amount: 0.35 },
};

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
    matrixTransforms: MatrixTransformState;
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
    private matrixTransforms: MatrixTransformState = {
        reciprocalLoops: { amount: DEFAULT_TRANSFORM_STATE.reciprocalLoops.amount },
        cycleInject: {
            amount: DEFAULT_TRANSFORM_STATE.cycleInject.amount,
            cycleLength: DEFAULT_TRANSFORM_STATE.cycleInject.cycleLength,
        },
        settle: { amount: DEFAULT_TRANSFORM_STATE.settle.amount },
    };
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
        this.numStates = DEFAULT_NUM_STATES;
        this.rawMatrix = makeSequentialMatrix(MAX_STATES);
        this.registry = registry;

        // Default per-state MIDI: first available device (channels 1..N), last active state = rest
        const defaultDevice = registry.findDefaultDevice() ?? '';
        this.stateMidi = Array.from({ length: MAX_STATES }, (_, i) => ({
            deviceName: i === DEFAULT_NUM_STATES - 1 ? 'rest' : defaultDevice,
            channel: DEFAULT_ACTIVE_STATE_CHANNELS[i] ?? i + 1,
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

    shiftMatrix(algorithm: MatrixShiftAlgorithm): void {
        const active = this.rawMatrix
            .slice(0, this.numStates)
            .map((row) => row.slice(0, this.numStates));
        const shifted = shiftMatrixValues(active, algorithm);
        this.replaceActiveRawMatrix(shifted);
        this.engine.updateMatrix(this.activeNormalizedMatrix());
    }

    applyMatrixTransform(
        algorithm: MatrixTransformAlgorithm,
        polarity: MatrixTransformPolarity,
        amount: number,
        cycleLength?: CycleLength
    ): void {
        const clampedAmount = Math.max(0, Math.min(1, amount));
        switch (algorithm) {
            case 'reciprocal_loops':
                this.matrixTransforms.reciprocalLoops.amount = clampedAmount;
                break;
            case 'cycle_inject':
                this.matrixTransforms.cycleInject.amount = clampedAmount;
                if (cycleLength !== undefined) {
                    this.matrixTransforms.cycleInject.cycleLength = this.clampCycleLength(cycleLength);
                }
                break;
            case 'settle':
                this.matrixTransforms.settle.amount = clampedAmount;
                break;
        }

        const active = this.activeNormalizedMatrix();
        const transformed = applyMatrixTransformValues(active, algorithm, polarity, {
            amount: clampedAmount,
            cycleLength: this.matrixTransforms.cycleInject.cycleLength,
        });

        this.replaceActiveRawMatrix(transformed);
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
            matrixTransforms: this.matrixTransformSnapshot(),
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
            matrixTransforms: snap.matrixTransforms,
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

    private replaceActiveRawMatrix(next: Matrix): void {
        for (let row = 0; row < this.numStates; row++) {
            for (let col = 0; col < this.numStates; col++) {
                this.rawMatrix[row][col] = next[row][col] ?? 0;
            }
        }
    }

    private clampCycleLength(value: number): CycleLength {
        if (value <= 2) return 2;
        if (value >= 4) return 4;
        return 3;
    }

    private matrixTransformSnapshot(): MatrixTransformState {
        return {
            reciprocalLoops: { amount: this.matrixTransforms.reciprocalLoops.amount },
            cycleInject: {
                amount: this.matrixTransforms.cycleInject.amount,
                cycleLength: this.matrixTransforms.cycleInject.cycleLength,
            },
            settle: { amount: this.matrixTransforms.settle.amount },
        };
    }
}
