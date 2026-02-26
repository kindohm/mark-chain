/**
 * Server entry point — Express + WebSocket
 */

import { createServer } from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ChainManager } from './chain/ChainManager.js';
import { AnchorInstance } from './anchor/AnchorInstance.js';
import { StabInstance } from './stab/StabInstance.js';
import { LayerInstance } from './layer/LayerInstance.js';
import chainConfigs from './config.js';
import type { ClientMessage, MixerScales, ServerMessage } from './protocol.js';
import { OscForwarder } from './osc/OscForwarder.js';
import { TransportClock } from './sequencer/TransportClock.js';

const PORT = 3000;
const MIXER_DEVICE = 'IAC Driver Bus 5';
const MIXER_CHANNEL = 1;
const MIXER_DEFAULT = 0.8;
const UI_FLUSH_INTERVAL_MS = 33;
const MIXER_CC_MAP = {
    drums: 1,
    anchor: 2,
    stab1: 3,
    stab2: 4,
    layer1: 5,
    layer2: 6,
} as const;

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// ─── Broadcast helper ────────────────────────────────────────────────────────

function broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
}

type UiDirtyState = {
    chains: Set<string>;
    anchor: boolean;
    stabs: Set<number>;
    layers: Set<number>;
};

const uiDirty: UiDirtyState = {
    chains: new Set(),
    anchor: false,
    stabs: new Set(),
    layers: new Set(),
};

function markChainUiDirty(chainId: string): void {
    uiDirty.chains.add(chainId);
}

function markAnchorUiDirty(): void {
    uiDirty.anchor = true;
}

function markStabUiDirty(stabId: number): void {
    uiDirty.stabs.add(stabId);
}

function markLayerUiDirty(layerId: number): void {
    uiDirty.layers.add(layerId);
}

const mixerScales: MixerScales = {
    drums: MIXER_DEFAULT,
    anchor: MIXER_DEFAULT,
    stab1: MIXER_DEFAULT,
    stab2: MIXER_DEFAULT,
    layer1: MIXER_DEFAULT,
    layer2: MIXER_DEFAULT,
};

const mixerUpdateMessage = (): ServerMessage => ({
    type: 'mixer_update',
    scales: { ...mixerScales },
});

// ─── OSC forwarding ──────────────────────────────────────────────────────────

let oscForwarder!: OscForwarder;

const oscConfigUpdateMessage = (): ServerMessage => ({
    type: 'osc_config_update',
    config: oscForwarder.getConfig(),
    midiDevices: registry.getAvailableDevices(),
});

const oscDebugSnapshotMessage = (): ServerMessage => ({
    type: 'osc_debug_snapshot',
    events: oscForwarder.getDebugLog(),
});

// ─── Chain manager ───────────────────────────────────────────────────────────

const chainManager = new ChainManager(chainConfigs);
const registry = chainManager.getRegistry();
const chains = chainManager.getAllChains();

oscForwarder = new OscForwarder({
    onDebugEvent: (event) => broadcast({ type: 'osc_debug_event', event }),
    getAvailableMidiDevices: () => registry.getAvailableDevices(),
});
oscForwarder.hydrateDefaults();

// ─── Anchor ──────────────────────────────────────────────────────────────────

const anchor = new AnchorInstance(120, registry);

// ─── Stabs ───────────────────────────────────────────────────────────────────

const stab0 = new StabInstance(0, 120, registry);
const stab1 = new StabInstance(1, 120, registry);

stab0.setMidi({ midiDevice: 'IAC Driver Bus 1' });
stab1.setMidi({ midiDevice: 'IAC Driver Bus 2' });
stab0.setMirror(false, 0);
stab1.setMirror(false, 1);

stab0.onStepEvent(() => markStabUiDirty(stab0.id));
stab1.onStepEvent(() => markStabUiDirty(stab1.id));
stab0.onNoteFiredEvent((stabId) => { void oscForwarder.forwardStab(stabId); });
stab1.onNoteFiredEvent((stabId) => { void oscForwarder.forwardStab(stabId); });

const stabs = [stab0, stab1];

// Mirror mode: when the Markov chain transitions, notify all stabs
for (const chain of chains) {
    chain.onStateChangeEvent(() => markChainUiDirty(chain.id));
    chain.onTransitionEvent((toState) => {
        for (const stab of stabs) stab.onDrumStep(toState);
    });
    chain.onMidiNoteSentEvent((event) => {
        if (event.chainId !== 'chain-0') return;
        void oscForwarder.forwardDrum({
            deviceName: event.deviceName,
            channel: event.channel,
        });
    });
}

// ─── Layers ──────────────────────────────────────────────────────────────────

const layer0 = new LayerInstance(0, 120, registry);
const layer1 = new LayerInstance(1, 120, registry);

// Layers use default device (first available) — no special default here
layer0.onStepEvent(() => markLayerUiDirty(layer0.id));
layer1.onStepEvent(() => markLayerUiDirty(layer1.id));

const layers = [layer0, layer1];
anchor.onStepEvent(() => markAnchorUiDirty());

const transport = new TransportClock({
    bpm: 120,
    onTick: () => {
        for (const chain of chains) chain.tick16th();
        anchor.tick16th();
        for (const s of stabs) s.tick16th();
        for (const l of layers) l.tick16th();
    },
});

setInterval(() => {
    if (uiDirty.chains.size === 0 && !uiDirty.anchor && uiDirty.stabs.size === 0 && uiDirty.layers.size === 0) {
        return;
    }

    for (const chainId of uiDirty.chains) {
        const chain = chainManager.getChain(chainId);
        if (chain) broadcast(chain.toStateUpdateMessage());
    }
    uiDirty.chains.clear();

    if (uiDirty.anchor) {
        broadcast(anchor.toUpdateMessage());
        uiDirty.anchor = false;
    }

    for (const stabId of uiDirty.stabs) {
        const stab = stabs[stabId];
        if (stab) broadcast(stab.toUpdateMessage());
    }
    uiDirty.stabs.clear();

    for (const layerId of uiDirty.layers) {
        const layer = layers[layerId];
        if (layer) broadcast(layer.toUpdateMessage());
    }
    uiDirty.layers.clear();
}, UI_FLUSH_INTERVAL_MS);

// ─── WebSocket connection handler ─────────────────────────────────────────────

wss.on('connection', (ws) => {
    console.log('Client connected');

    for (const msg of chainManager.getAllStateUpdates()) ws.send(JSON.stringify(msg));
    ws.send(JSON.stringify(anchor.toUpdateMessage()));
    for (const s of stabs) ws.send(JSON.stringify(s.toUpdateMessage()));
    for (const l of layers) ws.send(JSON.stringify(l.toUpdateMessage()));
    ws.send(JSON.stringify(mixerUpdateMessage()));
    ws.send(JSON.stringify(oscConfigUpdateMessage()));
    ws.send(JSON.stringify(oscDebugSnapshotMessage()));

    ws.on('message', (data) => {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(data.toString()) as ClientMessage;
        } catch {
            console.warn('Invalid message received:', data.toString());
            return;
        }

        // ── Anchor ────────────────────────────────────────────────────────────
        if (msg.type === 'set_anchor_enabled') { anchor.setEnabled(msg.isEnabled); broadcast(anchor.toUpdateMessage()); return; }
        if (msg.type === 'set_anchor_division') { anchor.setDivision(msg.division); broadcast(anchor.toUpdateMessage()); return; }
        if (msg.type === 'set_anchor_midi') { anchor.setMidi({ midiDevice: msg.midiDevice, channel: msg.channel }); broadcast(anchor.toUpdateMessage()); return; }

        // ── Stabs ─────────────────────────────────────────────────────────────
        if (msg.type === 'set_stab_enabled') { stabs[msg.stabId]?.setEnabled(msg.isEnabled); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_step') { stabs[msg.stabId]?.setStep(msg.stepIndex, msg.on); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_num_steps') { stabs[msg.stabId]?.setNumSteps(msg.numSteps); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_division') { stabs[msg.stabId]?.setDivision(msg.division); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_midi') { stabs[msg.stabId]?.setMidi({ midiDevice: msg.midiDevice, channel: msg.channel }); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_note') { stabs[msg.stabId]?.setNote(msg.midiNote); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_mirror') { stabs[msg.stabId]?.setMirror(msg.mirrorEnabled, msg.mirrorState); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_xy') { stabs[msg.stabId]?.setXY({ x: msg.x, y: msg.y }); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_stab_cc3') { stabs[msg.stabId]?.setCC3(msg.value); broadcast(stabs[msg.stabId]!.toUpdateMessage()); return; }

        // ── Layers ────────────────────────────────────────────────────────────
        if (msg.type === 'set_layer_enabled') { layers[msg.layerId]?.setEnabled(msg.isEnabled); broadcast(layers[msg.layerId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_layer_division') { layers[msg.layerId]?.setDivision(msg.division); broadcast(layers[msg.layerId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_layer_midi') { layers[msg.layerId]?.setMidi({ midiDevice: msg.midiDevice, channel: msg.channel }); broadcast(layers[msg.layerId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_layer_velocity') { layers[msg.layerId]?.setVelocity(msg.velocity); broadcast(layers[msg.layerId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_layer_duration_pct') { layers[msg.layerId]?.setDurationPct(msg.durationPct); broadcast(layers[msg.layerId]!.toUpdateMessage()); return; }
        if (msg.type === 'set_mixer_scale') {
            const value = Math.max(0, Math.min(1, msg.value));
            mixerScales[msg.target] = value;
            registry.sendControlChange(
                MIXER_DEVICE,
                MIXER_CHANNEL,
                MIXER_CC_MAP[msg.target],
                Math.round(value * 127)
            );
            broadcast(mixerUpdateMessage());
            return;
        }
        if (msg.type === 'set_osc_config') {
            oscForwarder.setConfig(msg.config);
            broadcast(oscConfigUpdateMessage());
            return;
        }

        // ── Chain messages (require chainId) ──────────────────────────────────
        const chain = chainManager.getChain((msg as { chainId?: string }).chainId ?? '');
        if (!chain) { console.warn('Unknown or missing chainId'); return; }

        switch (msg.type) {
            case 'set_cell':
                chain.setCell(msg.row, msg.col, msg.value);
                broadcast(chain.toStateUpdateMessage());
                break;
            case 'set_bpm':
                chain.setBpm(msg.bpm);
                transport.setBpm(msg.bpm);
                anchor.setBpm(msg.bpm);
                for (const s of stabs) s.setBpm(msg.bpm);
                for (const l of layers) l.setBpm(msg.bpm);
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
                for (const s of stabs) broadcast(s.toUpdateMessage());
                for (const l of layers) broadcast(l.toUpdateMessage());
                break;
            case 'set_num_states':
                chain.setNumStates(msg.numStates);
                broadcast(chain.toStateUpdateMessage());
                break;
            case 'set_state_midi':
                chain.setStateMidi(msg.stateIndex, {
                    ...(msg.deviceName !== undefined && { deviceName: msg.deviceName }),
                    ...(msg.channel !== undefined && { channel: msg.channel }),
                });
                broadcast(chain.toStateUpdateMessage());
                break;
            case 'set_velocity_min':
                chain.setVelocityMin(msg.stateIndex, msg.value);
                broadcast(chain.toStateUpdateMessage());
                break;
            case 'start':
                chain.start();
                anchor.resume();
                for (const s of stabs) s.resume();
                for (const l of layers) l.resume();
                transport.start();
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
                for (const s of stabs) broadcast(s.toUpdateMessage());
                for (const l of layers) broadcast(l.toUpdateMessage());
                break;
            case 'stop':
                chain.stop();
                transport.stop();
                anchor.pause();
                for (const s of stabs) s.pause();
                for (const l of layers) l.pause();
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
                for (const s of stabs) broadcast(s.toUpdateMessage());
                for (const l of layers) broadcast(l.toUpdateMessage());
                break;
        }
    });

    ws.on('close', () => console.log('Client disconnected'));
});

// ─── HTTP health check ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', chains: chainManager.getAllChains().length });
});

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
    console.log(`mark-chain server running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});
