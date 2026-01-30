import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './config.js';
import type { StateName } from '../core/markov.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the fs module
vi.mock('fs', async () => {
    const actual = await vi.importActual('fs');
    const mockFs: Record<string, string> = {};

    return {
        ...actual,
        existsSync: vi.fn((path: string) => {
            return mockFs[path] !== undefined;
        }),
        readFileSync: vi.fn((path: string) => {
            if (mockFs[path] === undefined) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            return mockFs[path];
        }),
        writeFileSync: vi.fn((path: string, data: string) => {
            mockFs[path] = data;
        }),
        unlinkSync: vi.fn((path: string) => {
            delete mockFs[path];
        }),
        mkdirSync: vi.fn(() => {
            // Mock directory creation - no-op
        }),
    };
});

describe('ConfigManager', () => {
    let configManager: ConfigManager;
    const testConfigName = 'mark-chain-test-' + Date.now();

    beforeEach(() => {
        // Clear all mocks before each test
        vi.clearAllMocks();
        configManager = new ConfigManager(testConfigName);
    });

    afterEach(() => {
        // Clean up test config file
        try {
            const configPath = configManager.getConfigPath();
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('constructor', () => {
        it('should initialize with default config', () => {
            const config = configManager.getConfig();
            expect(config.defaultNote).toBe(36);
            expect(config.tempo).toBe(120);
            expect(config.matrix.states).toEqual(['A', 'B', 'C', 'D']);
        });
    });

    describe('MIDI device', () => {
        it('should get and set MIDI device', () => {
            configManager.setMidiDevice('Test Device');
            expect(configManager.getMidiDevice()).toBe('Test Device');
        });
    });

    describe('state channel map', () => {
        it('should get default state channel map', () => {
            const map = configManager.getStateChannelMap();
            expect(map.A).toBe(0);
            expect(map.B).toBe(1);
            expect(map.C).toBe(2);
            expect(map.D).toBe(3);
        });

        it('should set state channel map', () => {
            const newMap = {
                A: 10,
                B: 11,
                C: 12,
                D: 13,
            } as Record<StateName, number>;

            configManager.setStateChannelMap(newMap);
            expect(configManager.getStateChannelMap()).toEqual(newMap);
        });
    });

    describe('default note', () => {
        it('should get and set default note', () => {
            configManager.setDefaultNote(60);
            expect(configManager.getDefaultNote()).toBe(60);
        });
    });

    describe('tempo', () => {
        it('should get and set tempo', () => {
            configManager.setTempo(140);
            expect(configManager.getTempo()).toBe(140);
        });
    });

    describe('matrix', () => {
        it('should get default matrix', () => {
            const matrix = configManager.getMatrix();
            expect(matrix.states).toEqual(['A', 'B', 'C', 'D']);
            expect(matrix.probabilities.A.B).toBe(1);
        });

        it('should set matrix', () => {
            const newMatrix = {
                states: ['A', 'B'] as StateName[],
                probabilities: {
                    A: { A: 0.5, B: 0.5 },
                    B: { A: 0.5, B: 0.5 },
                } as any,
            };

            configManager.setMatrix(newMatrix);
            expect(configManager.getMatrix()).toEqual(newMatrix);
        });
    });

    describe('CC mappings', () => {
        it('should get empty CC mappings by default', () => {
            const mappings = configManager.getCCMappings();
            expect(mappings).toEqual([]);
        });

        it('should add CC mapping', () => {
            const mapping = {
                fromState: 'A' as StateName,
                toState: 'B' as StateName,
                device: 'Test Device',
                channel: 0,
                cc: 1,
            };

            configManager.addCCMapping(mapping);
            const mappings = configManager.getCCMappings();
            expect(mappings).toHaveLength(1);
            expect(mappings[0]).toEqual(mapping);
        });

        it('should set CC mappings', () => {
            const mappings = [
                {
                    fromState: 'A' as StateName,
                    toState: 'B' as StateName,
                    device: 'Test Device',
                    channel: 0,
                    cc: 1,
                },
                {
                    fromState: 'B' as StateName,
                    toState: 'C' as StateName,
                    device: 'Test Device',
                    channel: 0,
                    cc: 2,
                },
            ];

            configManager.setCCMappings(mappings);
            expect(configManager.getCCMappings()).toEqual(mappings);
        });
    });

    describe('persistence', () => {
        it('should persist configuration across instances', () => {
            configManager.setMidiDevice('Persistent Device');
            configManager.setTempo(150);

            // Create new instance with same config name
            const newConfigManager = new ConfigManager(testConfigName);
            expect(newConfigManager.getMidiDevice()).toBe('Persistent Device');
            expect(newConfigManager.getTempo()).toBe(150);
        });
    });

    describe('reset', () => {
        it('should reset to defaults', () => {
            configManager.setMidiDevice('Test Device');
            configManager.setTempo(150);

            configManager.reset();

            expect(configManager.getMidiDevice()).toBe('');
            expect(configManager.getTempo()).toBe(120);
        });
    });

    describe('getConfigPath', () => {
        it('should return config file path', () => {
            const configPath = configManager.getConfigPath();
            expect(configPath).toContain(testConfigName);
        });
    });
});
