import { bpmToMs } from './engine.js';

export interface TransportClockOptions {
    bpm: number;
    onTick: () => void;
    onTickMetrics?: (metrics: TickMetrics) => void;
}

export interface TickMetrics {
    lagMs: number;
    tickDurationMs: number;
    catchUpDepth: number;
    overrun: boolean;
}

/**
 * Drift-corrected 16th-note clock driven by a monotonic timer.
 * Schedules against an absolute timeline and catches up if the event loop is late.
 */
export class TransportClock {
    private bpm: number;
    private readonly onTick: () => void;
    private readonly onTickMetrics: ((metrics: TickMetrics) => void) | null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private running = false;
    private nextTickAtMs = 0;

    constructor(opts: TransportClockOptions) {
        this.bpm = opts.bpm;
        this.onTick = opts.onTick;
        this.onTickMetrics = opts.onTickMetrics ?? null;
    }

    setBpm(bpm: number): void {
        this.bpm = bpm;
        if (!this.running) return;
        this.nextTickAtMs = this.nowMs() + bpmToMs(this.bpm);
        this.schedule();
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.nextTickAtMs = this.nowMs() + bpmToMs(this.bpm);
        this.schedule();
    }

    stop(): void {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    isRunning(): boolean {
        return this.running;
    }

    private schedule(): void {
        if (!this.running) return;
        if (this.timer) clearTimeout(this.timer);
        const delay = Math.max(0, this.nextTickAtMs - this.nowMs());
        this.timer = setTimeout(() => this.runDueTicks(), delay);
    }

    private runDueTicks(): void {
        if (!this.running) return;

        const intervalMs = bpmToMs(this.bpm);
        let now = this.nowMs();
        let ticksProcessed = 0;

        while (this.running && now >= this.nextTickAtMs && ticksProcessed < 128) {
            const lagMs = Math.max(0, now - this.nextTickAtMs);
            const tickStart = this.nowMs();
            this.onTick();
            const tickDurationMs = this.nowMs() - tickStart;
            this.nextTickAtMs += intervalMs;
            this.onTickMetrics?.({
                lagMs,
                tickDurationMs,
                catchUpDepth: ticksProcessed,
                overrun: false,
            });
            ticksProcessed++;
            now = this.nowMs();
        }

        if (ticksProcessed === 128 && now >= this.nextTickAtMs) {
            this.onTickMetrics?.({
                lagMs: Math.max(0, now - this.nextTickAtMs),
                tickDurationMs: 0,
                catchUpDepth: ticksProcessed,
                overrun: true,
            });
            // If we were stalled hard, re-anchor instead of spiraling.
            this.nextTickAtMs = now + intervalMs;
        }

        this.schedule();
    }

    private nowMs(): number {
        return performance.now();
    }
}
