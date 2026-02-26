/**
 * Shared WebSocket message types — mirrored from server/src/protocol.ts
 */

export interface StateMidiConfig {
    deviceName: string;
    channel: number;
}

export type MixerTarget = 'drums' | 'anchor' | 'stab1' | 'stab2' | 'layer1' | 'layer2';

export interface MixerScales {
    drums: number;
    anchor: number;
    stab1: number;
    stab2: number;
    layer1: number;
    layer2: number;
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
        velocityMin: number[];
    }
    | { type: 'step'; chainId: string; fromState: number; toState: number; step: number; timestamp: number }
    | {
        type: 'anchor_update';
        isEnabled: boolean; division: number; bpm: number;
        midiDevice: string; channel: number; midiDevices: string[]; stepCount: number;
    }
    | {
        type: 'stab_update';
        stabId: number; isEnabled: boolean; steps: boolean[]; numSteps: number;
        division: number; midiDevice: string; channel: number; midiNote: number;
        midiDevices: string[]; currentStep: number; mirrorEnabled: boolean; mirrorState: number;
        x: number; y: number; cc3: number;
    }
    | {
        type: 'layer_update';
        layerId: number; isEnabled: boolean; division: number;
        midiDevice: string; channel: number; velocity: number; durationPct: number; midiDevices: string[];
    }
    | { type: 'mixer_update'; scales: MixerScales };

export type ClientMessage =
    | { type: 'set_cell'; chainId: string; row: number; col: number; value: number }
    | { type: 'set_bpm'; chainId: string; bpm: number }
    | { type: 'set_num_states'; chainId: string; numStates: number }
    | { type: 'set_state_midi'; chainId: string; stateIndex: number; deviceName?: string; channel?: number }
    | { type: 'set_velocity_min'; chainId: string; stateIndex: number; value: number }
    | { type: 'start'; chainId: string }
    | { type: 'stop'; chainId: string }
    | { type: 'set_anchor_enabled'; isEnabled: boolean }
    | { type: 'set_anchor_division'; division: number }
    | { type: 'set_anchor_midi'; midiDevice?: string; channel?: number }
    | { type: 'set_stab_enabled'; stabId: number; isEnabled: boolean }
    | { type: 'set_stab_step'; stabId: number; stepIndex: number; on: boolean }
    | { type: 'set_stab_num_steps'; stabId: number; numSteps: number }
    | { type: 'set_stab_division'; stabId: number; division: number }
    | { type: 'set_stab_midi'; stabId: number; midiDevice?: string; channel?: number }
    | { type: 'set_stab_note'; stabId: number; midiNote: number }
    | { type: 'set_stab_mirror'; stabId: number; mirrorEnabled: boolean; mirrorState?: number }
    | { type: 'set_stab_xy'; stabId: number; x?: number; y?: number }
    | { type: 'set_stab_cc3'; stabId: number; value: number }
    | { type: 'set_layer_enabled'; layerId: number; isEnabled: boolean }
    | { type: 'set_layer_division'; layerId: number; division: number }
    | { type: 'set_layer_midi'; layerId: number; midiDevice?: string; channel?: number }
    | { type: 'set_layer_velocity'; layerId: number; velocity: number }
    | { type: 'set_layer_duration_pct'; layerId: number; durationPct: number }
    | { type: 'set_mixer_scale'; target: MixerTarget; value: number };

export interface ChainState {
    chainId: string; name: string; matrix: number[][]; bpm: number;
    numStates: number; isRunning: boolean; currentState: number; stepCount: number;
    stateMidi: StateMidiConfig[]; midiDevices: string[]; velocityMin: number[];
}

export interface AnchorState {
    isEnabled: boolean; division: number; bpm: number;
    midiDevice: string; channel: number; midiDevices: string[]; stepCount: number;
}

export interface StabState {
    stabId: number; isEnabled: boolean; steps: boolean[]; numSteps: number;
    division: number; midiDevice: string; channel: number; midiNote: number;
    midiDevices: string[]; currentStep: number; mirrorEnabled: boolean; mirrorState: number;
    x: number; y: number; cc3: number;
}

export interface LayerState {
    layerId: number;
    isEnabled: boolean;
    division: number;
    midiDevice: string;
    channel: number;
    velocity: number;
    durationPct: number;
    midiDevices: string[];
}
