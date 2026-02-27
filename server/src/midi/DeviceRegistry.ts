/**
 * DeviceRegistry — lazily opens and reuses easymidi outputs
 */

import easymidi from 'easymidi';

const DEVICE_CACHE_TTL_MS = 2000;

export class DeviceRegistry {
    private outputs: Map<string, easymidi.Output> = new Map();
    private cachedDevices: string[] = [];
    private deviceCacheAt = 0;

    getAvailableDevices(): string[] {
        return this.readAvailableDevices();
    }

    findDefaultDevice(): string | null {
        const outputs = this.readAvailableDevices();
        const rytm = outputs.find((n) => n.includes('RYTM') || n.includes('Rytm'));
        return rytm ?? (outputs.length > 0 ? outputs[0] : null);
    }

    private readAvailableDevices(forceRefresh = false): string[] {
        const now = Date.now();
        if (!forceRefresh && now - this.deviceCacheAt < DEVICE_CACHE_TTL_MS) {
            return [...this.cachedDevices];
        }
        try {
            this.cachedDevices = easymidi.getOutputs();
            this.deviceCacheAt = now;
        } catch {
            // Preserve last known list if the host call fails transiently.
        }
        return [...this.cachedDevices];
    }

    private getOutput(deviceName: string): easymidi.Output | null {
        if (this.outputs.has(deviceName)) {
            return this.outputs.get(deviceName)!;
        }
        try {
            const output = new easymidi.Output(deviceName);
            this.outputs.set(deviceName, output);
            return output;
        } catch {
            console.error(`Failed to open MIDI device "${deviceName}"`);
            return null;
        }
    }

    /**
     * Send a note-on + scheduled note-off.
     * channel is 1-indexed (as stored in StateMidiConfig); converted to 0-indexed for easymidi.
     */
    sendNote(
        deviceName: string,
        channel: number,  // 1-indexed
        note: number,
        velocity: number,
        durationMs: number
    ): void {
        const output = this.getOutput(deviceName);
        if (!output) return;
        const ch = channel - 1; // easymidi is 0-indexed
        try {
            // @ts-ignore — easymidi types are incomplete
            output.send('noteon', { note, velocity, channel: ch });
            setTimeout(() => {
                try {
                    // @ts-ignore
                    output.send('noteoff', { note, velocity: 0, channel: ch });
                } catch { }
            }, durationMs);
        } catch (err) {
            console.error('MIDI send error:', err);
        }
    }

    /**
     * Send a MIDI control change message.
     * channel is 1-indexed (as stored in UI state); converted to 0-indexed for easymidi.
     */
    sendControlChange(
        deviceName: string,
        channel: number,
        controller: number,
        value: number
    ): void {
        const output = this.getOutput(deviceName);
        if (!output) return;
        const ch = channel - 1;
        try {
            // @ts-ignore — easymidi types are incomplete
            output.send('cc', {
                controller: Math.max(0, Math.min(127, Math.round(controller))),
                value: Math.max(0, Math.min(127, Math.round(value))),
                channel: ch,
            });
        } catch (err) {
            console.error('MIDI CC send error:', err);
        }
    }

    closeAll(): void {
        for (const output of this.outputs.values()) {
            output.close();
        }
        this.outputs.clear();
        this.deviceCacheAt = 0;
    }
}
