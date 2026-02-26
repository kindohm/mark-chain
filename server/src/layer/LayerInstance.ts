/**
 * LayerInstance — slow-subdivision MIDI voice
 *
 * Fires a MIDI note every N 16th-note ticks (division up to 256).
 * Note duration is a percentage of the interval between notes.
 * Velocity is a fixed 0.0–1.0 knob value scaled to MIDI 0–127.
 *
 * Timer is controlled by the global start/stop.
 */

import { DeviceRegistry } from '../midi/DeviceRegistry.js';
import type { ServerMessage } from '../protocol.js';

const DEFAULT_NOTE = 36;
const bpmTo16thMs = (bpm: number): number => 60_000 / bpm / 4;

export class LayerInstance {
    readonly id: number; // 0 = Layer 1, 1 = Layer 2

    private bpm: number;
    private isEnabled: boolean = false;
    private division: number = 64;     // 1–256, default 64
    private midiDevice: string;
    private channel: number = 1;
    private velocity: number = 1.0;    // 0.0–1.0
    private durationPct: number = 0.5; // 0.01–1.0 fraction of interval

    private timerRunning: boolean = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private tickCount: number = 0;

    private registry: DeviceRegistry;
    private onStep: (() => void) | null = null;

    constructor(id: number, bpm: number, registry: DeviceRegistry) {
        this.id = id;
        this.bpm = bpm;
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
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    setEnabled(isEnabled: boolean): void { this.isEnabled = isEnabled; }
    setBpm(bpm: number): void { this.bpm = bpm; }

    setDivision(division: number): void {
        this.division = Math.max(1, Math.min(256, Math.round(division)));
    }

    setMidi(config: { midiDevice?: string; channel?: number }): void {
        if (config.midiDevice !== undefined) this.midiDevice = config.midiDevice;
        if (config.channel !== undefined) {
            this.channel = Math.max(1, Math.min(16, Math.round(config.channel)));
        }
    }

    setVelocity(velocity: number): void {
        this.velocity = Math.max(0, Math.min(1, velocity));
    }

    setDurationPct(pct: number): void {
        this.durationPct = Math.max(0.01, Math.min(1, pct));
    }

    // ── Broadcast hook ────────────────────────────────────────────────────────

    onStepEvent(cb: () => void): void { this.onStep = cb; }

    toUpdateMessage(): ServerMessage {
        return {
            type: 'layer_update',
            layerId: this.id,
            isEnabled: this.isEnabled,
            division: this.division,
            midiDevice: this.midiDevice,
            channel: this.channel,
            velocity: this.velocity,
            durationPct: this.durationPct,
            midiDevices: ['rest', ...this.registry.getAvailableDevices()],
        };
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private tick(): void {
        this.tickCount++;

        if (this.isEnabled && this.tickCount % this.division === 0) {
            if (this.midiDevice && this.midiDevice !== 'rest') {
                const intervalMs = bpmTo16thMs(this.bpm) * this.division;
                const durationMs = Math.max(1, Math.round(intervalMs * this.durationPct));
                const velocity = Math.min(127, Math.round(this.velocity * 127));
                this.registry.sendNote(this.midiDevice, this.channel, DEFAULT_NOTE, velocity, durationMs);
            }
        }

        if (this.onStep) this.onStep();
        this.scheduleNext();
    }

    private scheduleNext(): void {
        if (!this.timerRunning) return;
        this.timer = setTimeout(() => this.tick(), bpmTo16thMs(this.bpm));
    }
}
