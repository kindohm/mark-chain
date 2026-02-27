/**
 * Shared WebSocket message types — mirrored in client
 */

import type { StateMidiConfig } from './midi/types.js';
import type { OscConfig, OscDebugEvent } from './osc/OscForwarder.js';

export type MatrixShiftAlgorithm = 'up' | 'down' | 'left' | 'right' | 'snake' | 'reverse_snake';

// Client → Server
export type ClientMessage =
    | { type: 'set_cell'; chainId: string; row: number; col: number; value: number }
    | { type: 'shift_matrix'; chainId: string; algorithm: MatrixShiftAlgorithm }
    | { type: 'set_bpm'; chainId: string; bpm: number }
    | { type: 'set_num_states'; chainId: string; numStates: number }
    | { type: 'set_chain_enabled'; chainId: string; isEnabled: boolean }
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
    | { type: 'set_stab_mirror_off'; stabId: number; mirrorOffEnabled: boolean; mirrorOffState?: number }
    | { type: 'set_stab_xy'; stabId: number; x?: number; y?: number }
    | { type: 'set_stab_cc3'; stabId: number; value: number }
    | { type: 'set_stab_cc4'; stabId: number; value: number }
    | { type: 'set_layer_enabled'; layerId: number; isEnabled: boolean }
    | { type: 'set_layer_division'; layerId: number; division: number }
    | { type: 'set_layer_midi'; layerId: number; midiDevice?: string; channel?: number }
    | { type: 'set_layer_velocity'; layerId: number; velocity: number }
    | { type: 'set_layer_duration_pct'; layerId: number; durationPct: number }
    | { type: 'set_mixer_cc_level'; target: MixerTarget; value: number }
    | { type: 'set_osc_config'; config: Partial<OscConfig> };

// Server → Client
export type ServerMessage =
    | {
        type: 'state_update';
        chainId: string;
        name: string;
        matrix: number[][];
        bpm: number;
        numStates: number;
        isEnabled: boolean;
        isRunning: boolean;
        currentState: number;
        stepCount: number;
        stateMidi: StateMidiConfig[];
        midiDevices: string[];
        velocityMin: number[];
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
    }
    | {
        type: 'stab_update';
        stabId: number;
        isEnabled: boolean;
        steps: boolean[];
        numSteps: number;
        division: number;
        midiDevice: string;
        channel: number;
        midiNote: number;
        midiDevices: string[];
        currentStep: number;
        mirrorEnabled: boolean;
        mirrorState: number;
        mirrorOffEnabled: boolean;
        mirrorOffState: number;
        x: number;
        y: number;
        cc3: number;
        cc4: number;
    }
    | {
        type: 'layer_update';
        layerId: number;
        isEnabled: boolean;
        division: number;
        midiDevice: string;
        channel: number;
        velocity: number;
        durationPct: number;
        midiDevices: string[];
    }
    | {
        type: 'mixer_update';
        levels: MixerCcLevels;
    }
    | {
        type: 'osc_config_update';
        config: OscConfig;
        midiDevices: string[];
    }
    | {
        type: 'osc_debug_event';
        event: OscDebugEvent;
    }
    | {
        type: 'osc_debug_snapshot';
        events: OscDebugEvent[];
    };

export type MixerTarget = 'drums' | 'anchor' | 'stab1' | 'stab2' | 'layer1' | 'layer2';

export interface MixerCcLevels {
    drums: number;
    anchor: number;
    stab1: number;
    stab2: number;
    layer1: number;
    layer2: number;
}
