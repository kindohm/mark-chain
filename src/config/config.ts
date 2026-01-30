/**
 * Configuration management with persistence
 */

import Conf from 'conf';
import type { StateName } from '../core/markov.js';
import type { MarkovMatrixData } from '../core/markov.js';
import type { CCMapping } from '../midi/midi.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AppConfig {
    midiDevice: string;
    stateChannelMap: Record<StateName, number>;
    defaultNote: number;
    tempo: number;
    matrix: MarkovMatrixData;
}

export interface InputConfig {
    ccMappings: CCMapping[];
}

export class ConfigManager {
    private conf: Conf<AppConfig>;
    private inputConfigPath: string;
    private inputConfig: InputConfig;

    constructor(configName: string = 'mark-chain') {
        this.conf = new Conf<AppConfig>({
            projectName: configName,
            defaults: this.getDefaults(),
        });

        // Set up input config path
        const homeDir = os.homedir();
        const configDir = path.join(homeDir, '.mark-chain');
        this.inputConfigPath = path.join(configDir, 'input-config.json');

        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Load input config
        this.inputConfig = this.loadInputConfig();
    }

    /**
     * Load input configuration from file
     */
    private loadInputConfig(): InputConfig {
        try {
            if (fs.existsSync(this.inputConfigPath)) {
                const data = fs.readFileSync(this.inputConfigPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load input config:', error);
        }
        return { ccMappings: [] };
    }

    /**
     * Save input configuration to file
     */
    private saveInputConfig(): void {
        try {
            fs.writeFileSync(
                this.inputConfigPath,
                JSON.stringify(this.inputConfig, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save input config:', error);
        }
    }

    /**
     * Get default configuration
     */
    private getDefaults(): AppConfig {
        return {
            midiDevice: '',
            stateChannelMap: {
                A: 0,
                B: 1,
                C: 2,
                D: 3,
                E: 4,
                F: 5,
                G: 6,
                H: 7,
                I: 8,
                J: 9,
                K: 10,
                L: 11,
                M: 12,
                N: 13,
                O: 14,
                P: 15,
            } as Record<StateName, number>,
            defaultNote: 36,
            tempo: 120,
            matrix: {
                states: ['A', 'B', 'C', 'D'] as StateName[],
                probabilities: {
                    A: { A: 0, B: 1, C: 0, D: 0 },
                    B: { A: 0, B: 0, C: 1, D: 0 },
                    C: { A: 0, B: 0, C: 0, D: 1 },
                    D: { A: 1, B: 0, C: 0, D: 0 },
                } as any,
            },
        };
    }

    /**
     * Get the entire configuration
     */
    getConfig(): AppConfig {
        return this.conf.store;
    }

    /**
     * Save the entire configuration
     */
    saveConfig(config: Partial<AppConfig>): void {
        this.conf.set(config);
    }

    /**
     * Get MIDI device
     */
    getMidiDevice(): string {
        return this.conf.get('midiDevice');
    }

    /**
     * Set MIDI device
     */
    setMidiDevice(device: string): void {
        this.conf.set('midiDevice', device);
    }

    /**
     * Get state channel map
     */
    getStateChannelMap(): Record<StateName, number> {
        return this.conf.get('stateChannelMap');
    }

    /**
     * Set state channel map
     */
    setStateChannelMap(map: Record<StateName, number>): void {
        this.conf.set('stateChannelMap', map);
    }

    /**
     * Get default note
     */
    getDefaultNote(): number {
        return this.conf.get('defaultNote');
    }

    /**
     * Set default note
     */
    setDefaultNote(note: number): void {
        this.conf.set('defaultNote', note);
    }

    /**
     * Get tempo
     */
    getTempo(): number {
        return this.conf.get('tempo');
    }

    /**
     * Set tempo
     */
    setTempo(tempo: number): void {
        this.conf.set('tempo', tempo);
    }

    /**
     * Get matrix data
     */
    getMatrix(): MarkovMatrixData {
        return this.conf.get('matrix');
    }

    /**
     * Set matrix data
     */
    setMatrix(matrix: MarkovMatrixData): void {
        this.conf.set('matrix', matrix);
    }

    /**
     * Get CC mappings
     */
    getCCMappings(): CCMapping[] {
        return this.inputConfig.ccMappings;
    }

    /**
     * Set CC mappings
     */
    setCCMappings(mappings: CCMapping[]): void {
        this.inputConfig.ccMappings = mappings;
        this.saveInputConfig();
    }

    /**
     * Add a CC mapping
     */
    addCCMapping(mapping: CCMapping): void {
        this.inputConfig.ccMappings.push(mapping);
        this.saveInputConfig();
    }

    /**
     * Reset to defaults
     */
    reset(): void {
        this.conf.clear();
    }

    /**
     * Get config file path
     */
    getConfigPath(): string {
        return this.conf.path;
    }
}
