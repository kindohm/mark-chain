/**
 * StabInstance — linear on/off step sequencer
 *
 * Normal mode: fires MIDI notes for "on" steps at the configured division rate.
 * Mirror mode: fires whenever the Drum Markov chain enters the selected state.
 *
 * The internal 16th-note timer is controlled by global start/stop.
 */

import { DeviceRegistry } from '../midi/DeviceRegistry.js';
import type { ServerMessage } from '../protocol.js';

const DEFAULT_NOTE = 36;
const DEFAULT_VELOCITY = 100;
const DEFAULT_DURATION_MS = 100;
const DEFAULT_XY_VALUE = 64;
const DEFAULT_CC3_VALUE = 64;
const MAX_STEPS = 32;
const X_CC_NUMBER = 1;
const Y_CC_NUMBER = 2;
const Z_CC_NUMBER = 3;

const bpmTo16thMs = (bpm: number): number => 60_000 / bpm / 4;

export class StabInstance {
    readonly id: number;  // 0 = Stab 1, 1 = Stab 2

    private bpm: number;
    private isEnabled: boolean = false;
    private steps: boolean[];
    private numSteps: number = 16;
    private division: number = 1;      // advance pattern every N 16th notes
    private midiDevice: string;
    private channel: number = 1;
    private midiNote: number = DEFAULT_NOTE;

    // Mirror mode — fire when drum chain hits the selected state
    private mirrorEnabled: boolean = false;
    private mirrorState: number = 0;
    private x: number = DEFAULT_XY_VALUE;
    private y: number = DEFAULT_XY_VALUE;
    private cc3: number = DEFAULT_CC3_VALUE;

    // Timer state
    private timerRunning: boolean = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private tickCount: number = 0;   // 16th-note ticks since start/reset
    private currentStep: number = 0; // current position in the pattern

    private registry: DeviceRegistry;
    private onStep: (() => void) | null = null;
    private onNoteFired: ((stabId: number) => void) | null = null;

    constructor(id: number, bpm: number, registry: DeviceRegistry) {
        this.id = id;
        this.bpm = bpm;
        this.steps = Array(MAX_STEPS).fill(false);
        this.midiDevice = registry.findDefaultDevice() ?? '';
        this.registry = registry;
    }

    // ── Timer control ────────────────────────────────────────────────────────

    resume(): void {
        if (this.timerRunning) return;
        this.timerRunning = true;
        this.scheduleNext();
    }

    pause(): void {
        this.timerRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    setEnabled(isEnabled: boolean): void { this.isEnabled = isEnabled; }

    setBpm(bpm: number): void { this.bpm = bpm; } // takes effect on next tick

    setStep(stepIndex: number, on: boolean): void {
        if (stepIndex >= 0 && stepIndex < MAX_STEPS) this.steps[stepIndex] = on;
    }

    setNumSteps(n: number): void {
        this.numSteps = Math.max(1, Math.min(MAX_STEPS, Math.round(n)));
        if (this.currentStep >= this.numSteps) this.currentStep = 0;
    }

    setDivision(division: number): void {
        this.division = Math.max(1, Math.min(16, Math.round(division)));
    }

    setMidi(config: { midiDevice?: string; channel?: number }): void {
        if (config.midiDevice !== undefined) this.midiDevice = config.midiDevice;
        if (config.channel !== undefined) {
            this.channel = Math.max(1, Math.min(16, Math.round(config.channel)));
        }
    }

    setNote(midiNote: number): void {
        this.midiNote = Math.max(0, Math.min(127, Math.round(midiNote)));
    }

    setMirror(enabled: boolean, state?: number): void {
        this.mirrorEnabled = enabled;
        if (state !== undefined) this.mirrorState = Math.max(0, Math.min(7, state));
    }

    setXY(config: { x?: number; y?: number }): void {
        let xChanged = false;
        let yChanged = false;

        if (config.x !== undefined) {
            const nextX = Math.max(0, Math.min(127, Math.round(config.x)));
            if (nextX !== this.x) {
                this.x = nextX;
                xChanged = true;
            }
        }

        if (config.y !== undefined) {
            const nextY = Math.max(0, Math.min(127, Math.round(config.y)));
            if (nextY !== this.y) {
                this.y = nextY;
                yChanged = true;
            }
        }

        if (!this.midiDevice || this.midiDevice === 'rest') return;
        if (xChanged) this.registry.sendControlChange(this.midiDevice, this.channel, X_CC_NUMBER, this.x);
        if (yChanged) this.registry.sendControlChange(this.midiDevice, this.channel, Y_CC_NUMBER, this.y);
    }

    setCC3(value: number): void {
        const next = Math.max(0, Math.min(127, Math.round(value)));
        if (next === this.cc3) return;
        this.cc3 = next;

        if (!this.midiDevice || this.midiDevice === 'rest') return;
        this.registry.sendControlChange(this.midiDevice, this.channel, Z_CC_NUMBER, this.cc3);
    }

    // ── Mirror trigger — called by server when Markov chain transitions ───────

    onDrumStep(toState: number): void {
        if (!this.isEnabled || !this.mirrorEnabled) return;
        if (toState === this.mirrorState) this.fireNote();
    }

    // ── Broadcast hook ────────────────────────────────────────────────────────

    onStepEvent(cb: () => void): void {
        this.onStep = cb;
    }

    onNoteFiredEvent(cb: (stabId: number) => void): void {
        this.onNoteFired = cb;
    }

    toUpdateMessage(): ServerMessage {
        return {
            type: 'stab_update',
            stabId: this.id,
            isEnabled: this.isEnabled,
            steps: [...this.steps],
            numSteps: this.numSteps,
            division: this.division,
            midiDevice: this.midiDevice,
            channel: this.channel,
            midiNote: this.midiNote,
            midiDevices: ['rest', ...this.registry.getAvailableDevices()],
            currentStep: this.currentStep,
            mirrorEnabled: this.mirrorEnabled,
            mirrorState: this.mirrorState,
            x: this.x,
            y: this.y,
            cc3: this.cc3,
        };
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private tick(): void {
        this.tickCount++;

        // Advance the pattern step every `division` 16th-note ticks
        if (this.tickCount % this.division === 0) {
            this.currentStep = (this.currentStep + 1) % this.numSteps;

            // Fire note if: enabled, not in mirror mode, and this step is on
            if (this.isEnabled && !this.mirrorEnabled && this.steps[this.currentStep]) {
                this.fireNote();
            }
        }

        if (this.onStep) this.onStep();
        this.scheduleNext();
    }

    private fireNote(): void {
        if (!this.midiDevice || this.midiDevice === 'rest') return;
        this.registry.sendNote(
            this.midiDevice,
            this.channel,
            this.midiNote,
            DEFAULT_VELOCITY,
            DEFAULT_DURATION_MS
        );
        if (this.onNoteFired) this.onNoteFired(this.id);
    }

    private scheduleNext(): void {
        if (!this.timerRunning) return;
        this.timer = setTimeout(() => this.tick(), bpmTo16thMs(this.bpm));
    }
}
