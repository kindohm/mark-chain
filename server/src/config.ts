/**
 * Startup configuration — define chains here.
 * Each entry becomes one tab in the UI.
 */

export interface ChainConfig {
    id: string;
    name: string;
    /** Optional MIDI device name override. Falls back to auto-detect. */
    midiDeviceName?: string;
    bpm?: number;
}

const config: ChainConfig[] = [
    {
        id: 'chain-0',
        name: 'Default',
        bpm: 120,
    },
];

export default config;
