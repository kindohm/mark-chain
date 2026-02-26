/**
 * Server entry point — Express + WebSocket
 */

import { createServer } from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ChainManager } from './chain/ChainManager.js';
import { AnchorInstance } from './anchor/AnchorInstance.js';
import chainConfigs from './config.js';
import type { ClientMessage, ServerMessage } from './protocol.js';

const PORT = 3000;

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// ─── Broadcast helper ───────────────────────────────────────────────────────

function broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    }
}

// ─── Chain manager ──────────────────────────────────────────────────────────

const chainManager = new ChainManager(chainConfigs, broadcast);

// ─── Anchor instance ─────────────────────────────────────────────────────────

// BPM starts at 120 — kept in sync whenever set_bpm is received
const anchor = new AnchorInstance(120, chainManager.getRegistry());
anchor.onStepEvent(() => broadcast(anchor.toUpdateMessage()));
// Anchor starts paused — the global Start button calls resume()

// ─── WebSocket connection handler ────────────────────────────────────────────

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Send full state to new client
    for (const msg of chainManager.getAllStateUpdates()) {
        ws.send(JSON.stringify(msg));
    }
    ws.send(JSON.stringify(anchor.toUpdateMessage()));

    ws.on('message', (data) => {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(data.toString()) as ClientMessage;
        } catch {
            console.warn('Invalid message received:', data.toString());
            return;
        }

        // Anchor messages (no chainId)
        if (msg.type === 'set_anchor_enabled') {
            anchor.setEnabled(msg.isEnabled);
            broadcast(anchor.toUpdateMessage());
            return;
        }
        if (msg.type === 'set_anchor_division') {
            anchor.setDivision(msg.division);
            broadcast(anchor.toUpdateMessage());
            return;
        }
        if (msg.type === 'set_anchor_midi') {
            anchor.setMidi({ midiDevice: msg.midiDevice, channel: msg.channel });
            broadcast(anchor.toUpdateMessage());
            return;
        }

        // Chain messages (require chainId)
        const chain = chainManager.getChain((msg as { chainId?: string }).chainId ?? '');
        if (!chain) {
            console.warn('Unknown chainId or missing chainId');
            return;
        }

        switch (msg.type) {
            case 'set_cell':
                chain.setCell(msg.row, msg.col, msg.value);
                broadcast(chain.toStateUpdateMessage());
                break;

            case 'set_bpm':
                chain.setBpm(msg.bpm);
                anchor.setBpm(msg.bpm);          // keep anchor in sync
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
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

            case 'start':
                chain.start();
                anchor.resume();
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
                break;

            case 'stop':
                chain.stop();
                anchor.pause();
                broadcast(chain.toStateUpdateMessage());
                broadcast(anchor.toUpdateMessage());
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// ─── HTTP health check ───────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', chains: chainManager.getAllChains().length });
});

// ─── Start ───────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
    console.log(`mark-chain server running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});
