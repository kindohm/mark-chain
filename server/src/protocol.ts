/**
 * Shared WebSocket message types — mirrored in client
 */

import type { StateMidiConfig } from './midi/types.js';

// Client → Server
export type ClientMessage =
    | { type: 'set_cell'; chainId: string; row: number; col: number; value: number }
    | { type: 'set_bpm'; chainId: string; bpm: number }
    | { type: 'set_num_states'; chainId: string; numStates: number }
    | { type: 'set_state_midi'; chainId: string; stateIndex: number; deviceName?: string; channel?: number }
    | { type: 'start'; chainId: string }
    | { type: 'stop'; chainId: string }
    | { type: 'set_anchor_enabled'; isEnabled: boolean }
    | { type: 'set_anchor_division'; division: number }
    | { type: 'set_anchor_midi'; midiDevice?: string; channel?: number };

// Server → Client
export type ServerMessage =
    | {
        type: 'state_update';
        chainId: string;
        name: string;
        matrix: number[][];
        bpm: number;
        numStates: number;
        isRunning: boolean;
        currentState: number;
        stepCount: number;
        stateMidi: StateMidiConfig[];
        midiDevices: string[];
    }
    | {
        type: 'step';
        chainId: string;
        fromState: number;
        toState: number;
        step: number;
        timestamp: number;
    }
    | {
        type: 'anchor_update';
        isEnabled: boolean;
        division: number;
        bpm: number;
        midiDevice: string;
        channel: number;
        midiDevices: string[];
        stepCount: number;
    };
