/**
 * MIDI Manager — handles device connection and note output
 */

import easymidi from 'easymidi';
import type { MidiConfig, MidiNoteEvent } from './types.js';
import { stateToChannel, isRestState } from './types.js';

export class MidiManager {
    private output: easymidi.Output | null = null;
    private config: MidiConfig;

    constructor(config: Partial<MidiConfig> = {}) {
        this.config = {
            note: config.note ?? 36,
            velocity: config.velocity ?? 100,
            noteDuration: config.noteDuration ?? 100,
            numStates: config.numStates ?? 8,
        };
    }

    static getOutputs(): string[] {
        return easymidi.getOutputs();
    }

    static findDefaultDevice(): string | null {
        const outputs = easymidi.getOutputs();
        const rytm = outputs.find(
            (name) => name.includes('RYTM') || name.includes('Rytm')
        );
        return rytm ?? (outputs.length > 0 ? outputs[0] : null);
    }

    connect(deviceName: string): boolean {
        try {
            this.disconnect();
            this.output = new easymidi.Output(deviceName);
            console.log(`MIDI connected: "${deviceName}"`);
            return true;
        } catch (err) {
            console.error(`MIDI connect failed for "${deviceName}":`, err);
            return false;
        }
    }

    connectDefault(): boolean {
        const device = MidiManager.findDefaultDevice();
        if (!device) {
            console.warn('No MIDI devices available — running without MIDI output');
            return false;
        }
        return this.connect(device);
    }

    disconnect(): void {
        if (this.output) {
            this.output.close();
            this.output = null;
        }
    }

    isConnected(): boolean {
        return this.output !== null;
    }

    /**
     * Send a note for a given state index.
     * Returns false if it's a rest state or MIDI is not connected.
     */
    sendNoteForState(stateIndex: number): boolean {
        if (!this.output) return false;
        if (isRestState(stateIndex, this.config.numStates)) return false;

        const channel = stateToChannel(stateIndex, this.config.numStates);
        if (channel === null) return false;

        this.sendNote({
            channel,
            note: this.config.note,
            velocity: this.config.velocity,
            duration: this.config.noteDuration,
        });
        return true;
    }

    sendNote(event: MidiNoteEvent): void {
        if (!this.output) return;
        // @ts-ignore — easymidi types are incomplete
        this.output.send('noteon', {
            note: event.note,
            velocity: event.velocity,
            channel: event.channel,
        });
        if (event.duration) {
            setTimeout(() => {
                if (this.output) {
                    // @ts-ignore
                    this.output.send('noteoff', {
                        note: event.note,
                        velocity: 0,
                        channel: event.channel,
                    });
                }
            }, event.duration);
        }
    }

    updateConfig(config: Partial<MidiConfig>): void {
        this.config = { ...this.config, ...config };
    }

    getConfig(): MidiConfig {
        return { ...this.config };
    }
}
