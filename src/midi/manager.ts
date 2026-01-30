/**
 * MIDI manager - handles MIDI device connection and note output
 */

import easymidi from 'easymidi';
import type { MidiDevice, MidiNoteEvent, MidiConfig } from './types.js';
import { stateToChannel, isRestState } from './types.js';

/**
 * MIDI Manager class
 */
export class MidiManager {
    private output: easymidi.Output | null = null;
    private config: MidiConfig;

    constructor(config: Partial<MidiConfig> = {}) {
        this.config = {
            note: config.note ?? 36,
            velocity: config.velocity ?? 100,
            noteDuration: config.noteDuration ?? 100,
            numStates: config.numStates ?? 4,
        };
    }

    /**
     * Get list of available MIDI output devices
     */
    static getOutputs(): MidiDevice[] {
        const outputs = easymidi.getOutputs();
        return outputs.map((name) => ({ name }));
    }

    /**
     * Find default MIDI device (looks for "RYTM" or "Rytm")
     */
    static findDefaultDevice(): string | null {
        const outputs = easymidi.getOutputs();
        const rytmDevice = outputs.find(
            (name) => name.includes('RYTM') || name.includes('Rytm')
        );
        return rytmDevice ?? (outputs.length > 0 ? outputs[0] : null);
    }

    /**
     * Connect to a MIDI output device
     */
    connect(deviceName: string): boolean {
        try {
            this.disconnect();
            this.output = new easymidi.Output(deviceName);
            return true;
        } catch (error) {
            console.error(`Failed to connect to MIDI device "${deviceName}":`, error);
            return false;
        }
    }

    /**
     * Connect to the default device
     */
    connectDefault(): boolean {
        const deviceName = MidiManager.findDefaultDevice();
        if (!deviceName) {
            console.error('No MIDI devices available');
            return false;
        }
        return this.connect(deviceName);
    }

    /**
     * Disconnect from current MIDI device
     */
    disconnect(): void {
        if (this.output) {
            this.output.close();
            this.output = null;
        }
    }

    /**
     * Check if connected to a device
     */
    isConnected(): boolean {
        return this.output !== null;
    }

    /**
     * Send a note for a given state
     * Returns true if note was sent, false if it's a rest state
     */
    sendNoteForState(stateIndex: number): boolean {
        if (!this.output) {
            console.warn('MIDI not connected');
            return false;
        }

        // Check if this is a rest state
        if (isRestState(stateIndex, this.config.numStates)) {
            return false;
        }

        const channel = stateToChannel(stateIndex, this.config.numStates);
        if (channel === null) {
            return false;
        }

        this.sendNote({
            channel,
            note: this.config.note,
            velocity: this.config.velocity,
            duration: this.config.noteDuration,
        });

        return true;
    }

    /**
     * Send a MIDI note on/off event
     */
    sendNote(event: MidiNoteEvent): void {
        if (!this.output) {
            console.warn('MIDI not connected');
            return;
        }

        // Send note on
        // @ts-ignore - easymidi types are incomplete
        this.output.send('noteon', {
            note: event.note,
            velocity: event.velocity,
            channel: event.channel,
        });

        // Schedule note off
        if (event.duration) {
            setTimeout(() => {
                if (this.output) {
                    // @ts-ignore - easymidi types are incomplete
                    this.output.send('noteoff', {
                        note: event.note,
                        velocity: 0,
                        channel: event.channel,
                    });
                }
            }, event.duration);
        }
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<MidiConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get current configuration
     */
    getConfig(): MidiConfig {
        return { ...this.config };
    }
}
