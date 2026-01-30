/**
 * MIDI handling for output and input
 */

import easymidi from 'easymidi';
import type { StateName } from '../core/markov.js';

export interface MidiDeviceConfig {
    deviceName: string;
    stateChannelMap: Record<StateName, number>;
    defaultNote: number;
}

export interface CCMapping {
    fromState: StateName;
    toState: StateName;
    device: string;
    channel: number;
    cc: number;
}

export class MidiHandler {
    private output: easymidi.Output | null;
    private input: easymidi.Input | null;
    private config: MidiDeviceConfig;
    private ccMappings: Map<string, CCMapping>; // key: "device:channel:cc"

    constructor(config: MidiDeviceConfig) {
        this.config = config;
        this.output = null;
        this.input = null;
        this.ccMappings = new Map();
    }

    /**
     * Get list of available MIDI output devices
     */
    static getOutputDevices(): string[] {
        return easymidi.getOutputs();
    }

    /**
     * Get list of available MIDI input devices
     */
    static getInputDevices(): string[] {
        return easymidi.getInputs();
    }

    /**
   * Find default MIDI device (contains "RYTM" or "Rytm")
   */
    static findDefaultDevice(): string | null {
        const outputs = MidiHandler.getOutputDevices();
        const rytmDevice = outputs.find(name =>
            name.toLowerCase().includes('rytm')
        );
        return rytmDevice || (outputs.length > 0 ? outputs[0] : null);
    }

    /**
     * Find Twister MIDI input device (contains "Twister" or "twister")
     */
    static findTwisterDevice(): string | null {
        const inputs = MidiHandler.getInputDevices();
        const twisterDevice = inputs.find(name =>
            name.toLowerCase().includes('twister')
        );
        return twisterDevice || null;
    }

    /**
     * Open MIDI output device
     */
    openOutput(deviceName?: string): void {
        const device = deviceName || this.config.deviceName;

        try {
            this.output = new easymidi.Output(device);
        } catch (error) {
            throw new Error(`Failed to open MIDI output device: ${device}`);
        }
    }

    /**
     * Open MIDI input device
     */
    openInput(deviceName?: string): void {
        const device = deviceName || this.config.deviceName;

        try {
            this.input = new easymidi.Input(device);
        } catch (error) {
            throw new Error(`Failed to open MIDI input device: ${device}`);
        }
    }

    /**
   * Close MIDI devices
   */
    close(): void {
        if (this.output) {
            this.output.close();
            this.output = null;
        }
        this.closeInput();
    }

    /**
     * Close MIDI input device
     */
    closeInput(): void {
        if (this.input) {
            this.input.close();
            this.input = null;
        }
    }

    /**
     * Send MIDI note for a given state
     */
    sendNote(state: StateName, velocity: number = 100, duration: number = 100): void {
        if (!this.output) {
            throw new Error('MIDI output not opened');
        }

        const channel = this.config.stateChannelMap[state];
        if (channel === undefined) {
            throw new Error(`No channel mapping for state: ${state}`);
        }

        const note = this.config.defaultNote;

        // Send note on (using type assertion for easymidi compatibility)
        (this.output as any).send('noteon', {
            note,
            velocity,
            channel,
        });

        // Schedule note off
        setTimeout(() => {
            if (this.output) {
                (this.output as any).send('noteoff', {
                    note,
                    velocity: 0,
                    channel,
                });
            }
        }, duration);
    }

    /**
     * Add CC mapping for learning mode
     */
    addCCMapping(mapping: CCMapping): void {
        const key = `${mapping.device}:${mapping.channel}:${mapping.cc}`;
        this.ccMappings.set(key, mapping);
    }

    /**
   * Start listening for CC messages to control matrix probabilities
   */
    startCCControl(
        inputDevice: string,
        matrix: any,
        onUpdate?: () => void
    ): void {
        try {
            this.openInput(inputDevice);

            this.onCC((device, channel, cc, value) => {
                // Find matching CC mapping
                const key = `${inputDevice}:${channel}:${cc}`;
                const mapping = this.ccMappings.get(key);

                if (mapping) {
                    // Convert MIDI value (0-127) to probability (0.0-1.0)
                    const probability = value / 127;

                    // Update the matrix
                    matrix.setProbability(mapping.fromState, mapping.toState, probability);

                    // Notify of update
                    if (onUpdate) {
                        onUpdate();
                    }
                }
            });
        } catch (error) {
            console.error(`Failed to start CC control: ${(error as Error).message}`);
        }
    }

    /**
     * Stop CC control
     */
    stopCCControl(): void {
        this.removeAllCCListeners();
        this.closeInput();
    }

    /**
     * Get CC mapping
     */
    getCCMapping(device: string, channel: number, cc: number): CCMapping | undefined {
        const key = `${device}:${channel}:${cc}`;
        return this.ccMappings.get(key);
    }

    /**
     * Get all CC mappings
     */
    getAllCCMappings(): CCMapping[] {
        return Array.from(this.ccMappings.values());
    }

    /**
     * Listen for CC messages and call callback
     */
    onCC(callback: (device: string, channel: number, cc: number, value: number) => void): void {
        if (!this.input) {
            throw new Error('MIDI input not opened');
        }

        this.input.on('cc', (msg) => {
            callback(this.config.deviceName, msg.channel, msg.controller, msg.value);
        });
    }

    /**
     * Remove all CC listeners
     */
    removeAllCCListeners(): void {
        if (this.input) {
            this.input.removeAllListeners('cc');
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): MidiDeviceConfig {
        return { ...this.config };
    }
}
