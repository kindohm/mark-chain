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

const PORT = 3000;
const MIXER_DEVICE = 'IAC Driver Bus 5';
const MIXER_CHANNEL = 1;
const MIXER_DEFAULT = 0.8;
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

// ─── Chain manager ───────────────────────────────────────────────────────────

const chainManager = new ChainManager(chainConfigs, broadcast);
const registry = chainManager.getRegistry();

// ─── Anchor ──────────────────────────────────────────────────────────────────

const anchor = new AnchorInstance(120, registry);
anchor.onStepEvent(() => broadcast(anchor.toUpdateMessage()));

// ─── Stabs ───────────────────────────────────────────────────────────────────

const stab0 = new StabInstance(0, 120, registry);
const stab1 = new StabInstance(1, 120, registry);

stab0.setMidi({ midiDevice: 'IAC Driver Bus 1' });
stab1.setMidi({ midiDevice: 'IAC Driver Bus 2' });
stab0.setMirror(false, 0);
stab1.setMirror(false, 1);

stab0.onStepEvent(() => broadcast(stab0.toUpdateMessage()));
stab1.onStepEvent(() => broadcast(stab1.toUpdateMessage()));

const stabs = [stab0, stab1];

// Mirror mode: when the Markov chain transitions, notify all stabs
for (const chain of chainManager.getAllChains()) {
    chain.onTransitionEvent((toState) => {
        for (const stab of stabs) stab.onDrumStep(toState);
    });
}

// ─── Layers ──────────────────────────────────────────────────────────────────

const layer0 = new LayerInstance(0, 120, registry);
const layer1 = new LayerInstance(1, 120, registry);

// Layers use default device (first available) — no special default here
layer0.onStepEvent(() => broadcast(layer0.toUpdateMessage()));
layer1.onStepEvent(() => broadcast(layer1.toUpdateMessage()));

const layers = [layer0, layer1];

// ─── WebSocket connection handler ─────────────────────────────────────────────

wss.on('connection', (ws) => {
    console.log('Client connected');

    for (const msg of chainManager.getAllStateUpdates()) ws.send(JSON.stringify(msg));
    ws.send(JSON.stringify(anchor.toUpdateMessage()));
    for (const s of stabs) ws.send(JSON.stringify(s.toUpdateMessage()));
    for (const l of layers) ws.send(JSON.stringify(l.toUpdateMessage()));
    ws.send(JSON.stringify(mixerUpdateMessage()));

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
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
                for (const s of stabs) broadcast(s.toUpdateMessage());
                for (const l of layers) broadcast(l.toUpdateMessage());
                break;
            case 'stop':
                chain.stop();
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
