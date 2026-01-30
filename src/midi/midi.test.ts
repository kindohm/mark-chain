import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MidiHandler } from './midi.js';
import type { StateName } from '../core/markov.js';

// Mock easymidi
vi.mock('easymidi', () => {
    const mockOutputs = ['Elektron Analog Rytm MKII', 'IAC Driver Bus 1', 'Virtual MIDI Device'];
    const mockInputs = ['Elektron Analog Rytm MKII', 'IAC Driver Bus 1'];

    class MockOutput {
        name: string;
        messages: any[];

        constructor(name: string) {
            this.name = name;
            this.messages = [];
        }

        send(type: string, data: any) {
            this.messages.push({ type, data });
        }

        close() {
            // Mock close
        }
    }

    class MockInput {
        name: string;
        listeners: Map<string, Function[]>;

        constructor(name: string) {
            this.name = name;
            this.listeners = new Map();
        }

        on(event: string, callback: Function) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event)!.push(callback);
        }

        removeAllListeners(event: string) {
            this.listeners.delete(event);
        }

        close() {
            // Mock close
        }

        // Test helper to trigger events
        trigger(event: string, data: any) {
            const callbacks = this.listeners.get(event) || [];
            callbacks.forEach(cb => cb(data));
        }
    }

    return {
        default: {
            Output: MockOutput,
            Input: MockInput,
            getOutputs: () => mockOutputs,
            getInputs: () => mockInputs,
        },
    };
});

describe('MidiHandler', () => {
    const defaultConfig = {
        deviceName: 'Elektron Analog Rytm MKII',
        stateChannelMap: {
            A: 0,
            B: 1,
            C: 2,
            D: 3,
        } as Record<StateName, number>,
        defaultNote: 36,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('static methods', () => {
        it('should get output devices', () => {
            const devices = MidiHandler.getOutputDevices();
            expect(devices).toContain('Elektron Analog Rytm MKII');
            expect(devices).toContain('IAC Driver Bus 1');
        });

        it('should get input devices', () => {
            const devices = MidiHandler.getInputDevices();
            expect(devices).toContain('Elektron Analog Rytm MKII');
        });

        it('should find default device with RYTM in name', () => {
            const device = MidiHandler.findDefaultDevice();
            expect(device).toBe('Elektron Analog Rytm MKII');
        });
    });

    describe('constructor', () => {
        it('should initialize with config', () => {
            const handler = new MidiHandler(defaultConfig);
            expect(handler.getConfig()).toEqual(defaultConfig);
        });
    });

    describe('openOutput and close', () => {
        it('should open output device', () => {
            const handler = new MidiHandler(defaultConfig);
            expect(() => handler.openOutput()).not.toThrow();
        });

        it('should close devices', () => {
            const handler = new MidiHandler(defaultConfig);
            handler.openOutput();
            expect(() => handler.close()).not.toThrow();
        });
    });

    describe('sendNote', () => {
        it('should send MIDI note for state', () => {
            vi.useFakeTimers();

            const handler = new MidiHandler(defaultConfig);
            handler.openOutput();

            handler.sendNote('A' as StateName, 100, 100);

            vi.advanceTimersByTime(150);
            vi.restoreAllMocks();
        });

        it('should throw error if output not opened', () => {
            const handler = new MidiHandler(defaultConfig);
            expect(() => handler.sendNote('A' as StateName)).toThrow('MIDI output not opened');
        });

        it('should throw error for unmapped state', () => {
            const handler = new MidiHandler(defaultConfig);
            handler.openOutput();
            expect(() => handler.sendNote('E' as StateName)).toThrow('No channel mapping for state: E');
        });
    });

    describe('CC mappings', () => {
        it('should add and get CC mapping', () => {
            const handler = new MidiHandler(defaultConfig);

            const mapping = {
                fromState: 'A' as StateName,
                toState: 'B' as StateName,
                device: 'Test Device',
                channel: 0,
                cc: 1,
            };

            handler.addCCMapping(mapping);

            const retrieved = handler.getCCMapping('Test Device', 0, 1);
            expect(retrieved).toEqual(mapping);
        });

        it('should get all CC mappings', () => {
            const handler = new MidiHandler(defaultConfig);

            const mapping1 = {
                fromState: 'A' as StateName,
                toState: 'B' as StateName,
                device: 'Test Device',
                channel: 0,
                cc: 1,
            };

            const mapping2 = {
                fromState: 'B' as StateName,
                toState: 'C' as StateName,
                device: 'Test Device',
                channel: 0,
                cc: 2,
            };

            handler.addCCMapping(mapping1);
            handler.addCCMapping(mapping2);

            const all = handler.getAllCCMappings();
            expect(all).toHaveLength(2);
            expect(all).toContainEqual(mapping1);
            expect(all).toContainEqual(mapping2);
        });

        it('should return undefined for non-existent mapping', () => {
            const handler = new MidiHandler(defaultConfig);
            const retrieved = handler.getCCMapping('Test Device', 0, 99);
            expect(retrieved).toBeUndefined();
        });
    });

    describe('onCC', () => {
        it('should throw error if input not opened', () => {
            const handler = new MidiHandler(defaultConfig);
            expect(() => handler.onCC(() => { })).toThrow('MIDI input not opened');
        });

        it('should remove all CC listeners', () => {
            const handler = new MidiHandler(defaultConfig);
            handler.openInput();
            expect(() => handler.removeAllCCListeners()).not.toThrow();
        });
    });
});
