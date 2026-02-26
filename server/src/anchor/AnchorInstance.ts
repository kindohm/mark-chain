/**
 * AnchorInstance — simple 16th-note division counter
 *
 * The internal step counter runs continuously.
 * The on/off toggle only gates MIDI output.
 * BPM is kept in sync with the main chain via setBpm().
 */

import { DeviceRegistry } from '../midi/DeviceRegistry.js';
import type { ServerMessage } from '../protocol.js';

const DEFAULT_NOTE = 36;
const DEFAULT_VELOCITY = 100;
const DEFAULT_DURATION_MS = 100;

export class AnchorInstance {
    private bpm: number;
    private division: number = 4;
    private isEnabled: boolean = false;
    private midiDevice: string;
    private channel: number = 1;
    private stepCount: number = 0;
    private timerRunning: boolean = false;
    private registry: DeviceRegistry;
    private onStep: (() => void) | null = null;

    constructor(bpm: number, registry: DeviceRegistry) {
        this.bpm = bpm;
        this.midiDevice = registry.findDefaultDevice() ?? '';
        this.registry = registry;
    }

    /** Start (or resume) the step counter — called when global sequencer starts */
    resume(): void {
        if (this.timerRunning) return;
        this.timerRunning = true;
    }

    /** Pause the step counter — called when global sequencer stops */
    pause(): void {
        this.timerRunning = false;
    }

    /** Register a callback fired on every tick (for broadcasting state) */
    onStepEvent(cb: () => void): void {
        this.onStep = cb;
    }

    setEnabled(isEnabled: boolean): void {
        this.isEnabled = isEnabled;
    }

    setDivision(division: number): void {
        this.division = Math.max(1, Math.min(16, Math.round(division)));
    }

    /** Sync BPM from the global set_bpm message; takes effect on next tick */
    setBpm(bpm: number): void {
        this.bpm = bpm;
    }

    setMidi(config: { midiDevice?: string; channel?: number }): void {
        if (config.midiDevice !== undefined) this.midiDevice = config.midiDevice;
        if (config.channel !== undefined) {
            this.channel = Math.max(1, Math.min(16, Math.round(config.channel)));
        }
    }

    toUpdateMessage(): ServerMessage {
        return {
            type: 'anchor_update',
            isEnabled: this.isEnabled,
            division: this.division,
            bpm: this.bpm,
            midiDevice: this.midiDevice,
            channel: this.channel,
            midiDevices: ['rest', ...this.registry.getAvailableDevices()],
            stepCount: this.stepCount,
        };
    }

    private tick(): void {
        if (!this.timerRunning) return;
        this.stepCount++;

        if (this.isEnabled && this.stepCount % this.division === 0) {
            if (this.midiDevice && this.midiDevice !== 'rest') {
                this.registry.sendNote(
                    this.midiDevice,
                    this.channel,
                    DEFAULT_NOTE,
                    DEFAULT_VELOCITY,
                    DEFAULT_DURATION_MS
                );
            }
        }

        if (this.onStep) this.onStep();
    }

    tick16th(): void {
        this.tick();
    }
}
