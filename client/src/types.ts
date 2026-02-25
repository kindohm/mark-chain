/**
 * Shared WebSocket message types — mirrored from server/src/protocol.ts
 */

export interface StateMidiConfig {
    deviceName: string;
    /** 1-indexed MIDI channel */
    channel: number;
}

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
    };

export type ClientMessage =
    | { type: 'set_cell'; chainId: string; row: number; col: number; value: number }
    | { type: 'set_bpm'; chainId: string; bpm: number }
    | { type: 'set_num_states'; chainId: string; numStates: number }
    | { type: 'set_state_midi'; chainId: string; stateIndex: number; deviceName?: string; channel?: number }
    | { type: 'start'; chainId: string }
    | { type: 'stop'; chainId: string };

export interface ChainState {
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
