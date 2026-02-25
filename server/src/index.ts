/**
 * Server entry point — Express + WebSocket
 */

import { createServer } from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { ChainManager } from './chain/ChainManager.js';
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

// ─── WebSocket connection handler ────────────────────────────────────────────

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Send current state of all chains to the new client
    for (const msg of chainManager.getAllStateUpdates()) {
        ws.send(JSON.stringify(msg));
    }

    ws.on('message', (data) => {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(data.toString()) as ClientMessage;
        } catch {
            console.warn('Invalid message received:', data.toString());
            return;
        }

        const chain = chainManager.getChain(msg.chainId);
        if (!chain) {
            console.warn(`Unknown chainId: ${msg.chainId}`);
            return;
        }

        switch (msg.type) {
            case 'set_cell':
                chain.setCell(msg.row, msg.col, msg.value);
                broadcast(chain.toStateUpdateMessage());
                break;

            case 'set_bpm':
                chain.setBpm(msg.bpm);
                broadcast(chain.toStateUpdateMessage());
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
                broadcast(chain.toStateUpdateMessage());
                break;

            case 'stop':
                chain.stop();
                broadcast(chain.toStateUpdateMessage());
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
