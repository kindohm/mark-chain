# brunchh

A browser-based Markov MIDI sequencer with a TypeScript server and React client.

## What It Does

`brunchh` is a live performance/control tool for generating MIDI patterns from a Markov transition matrix and synchronized voice lanes.

Main capabilities:

- Markov drum sequencing with editable transition probabilities
- Additional synchronized voices (Anchor, Stabs, Layers)
- Per-lane MIDI routing and timing controls
- OSC forwarding and debug visibility

## Install

Requirements:

- Node.js `>=18`
- A MIDI environment recognized by `easymidi`

Install dependencies:

```bash
cd server && npm install
cd ../client && npm install
```

## Run

Start server and client in separate terminals.

Terminal 1 (server):

```bash
cd server
npm run dev
```

Terminal 2 (client):

```bash
cd client
npm run dev
```

Open the client URL shown by Vite (typically `http://localhost:5173`).

Server endpoints:

- Health check: `http://localhost:3000/health`
- WebSocket: `ws://localhost:3000`

## How To Use

1. Open the app in your browser and wait for WebSocket connection.
2. In the Drums tab:

- Edit matrix cell values to shape state transitions.
- Set BPM, state count, and per-state MIDI routing.
- Use transport start/stop for global playback.

3. In Anchor/Stab/Layer tabs:

- Enable lanes and set divisions/rhythmic behavior.
- Configure MIDI target device/channel.
- For Stabs, use pattern steps and optional mirror/mirror-off modes.

4. In Mixer/OSC tabs:

- Set lane mix levels (MIDI CC outputs).
- Configure OSC forwarding and inspect debug events.

## High-Level Architecture

- `client` (`React` + `Vite`):
  Browser UI that renders server state, emits control commands, and manages connection/reconnect behavior.
- `server` (`Node.js` + `Express` + `ws`):
  Real-time orchestration layer that owns transport, sequencing state, MIDI output, and OSC forwarding.
- Stateful domain components on the server:
  `ChainInstance` (Markov drums), `AnchorInstance`, `StabInstance`, `LayerInstance`, coordinated by a shared transport clock.
- Message boundary:
  Typed WebSocket protocol (`ClientMessage` / `ServerMessage`) is the control and state-sync contract between client and server.
- Data flow:
  Client sends intent (commands), server mutates authoritative state, then server broadcasts state snapshots/events to all clients.

## High-Level Approach

- Single source of truth:
  Sequencing state is server-owned; the client is a thin command+view layer over that state.
- Deterministic timing core:
  A shared 16th-note clock drives all lane ticks to keep cross-lane timing aligned at a single BPM.
- Probabilistic + deterministic composition:
  Drums are Markov-driven (probability matrix), while anchor/stab/layer lanes add rule-based rhythmic structure.
- Explicit integration boundaries:
  MIDI and OSC are side-effect outputs from server state transitions, not client-side behavior.

## Testing and Quality

Server tests:

```bash
cd server
npm test
```

Client checks:

```bash
cd client
npm run lint
npm run build
```

## Notes

- Current defaults (ports/device names) are set in `server/src/index.ts` and related modules.
- Keep protocol updates mirrored between `server/src/protocol.ts` and `client/src/types.ts`.
