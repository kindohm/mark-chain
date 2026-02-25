# mark-chain v2 — Spec

## What we're building

A web-based Markov chain MIDI sequencer with two pieces:

1. **Node server** — owns all sequencer state, scheduling, and MIDI output
2. **React client** — a browser UI that lets you view and edit the sequencer state in real time

---

## Architecture

```
Browser (React)  <--WebSocket-->  Node server  -->  MIDI output
```

**Why WebSockets**: The server needs to push real-time state to the client (which state is currently playing, step count). The client needs to send probability edits to the server without polling. WebSockets are the right fit.

The server holds the single source of truth for the matrix. The client is a view + controller.

**Project structure (proposed)**:

```
mark-chain/
  server/          # Node.js + TypeScript server
    src/
      sequencer/   # scheduling engine (adapted from src-OLD)
      midi/        # MIDI output
      index.ts     # Express + WebSocket server
  client/          # React app (Vite)
    src/
      components/
      ...
```

---

## The Matrix

8x8 grid. Rows = states (0–7). Columns = transition targets (0–7).

Each cell `matrix[row][col]` is a probability: how likely it is that, when in state `row`, the next step lands on state `col`.

### Normalization

Each row should sum to 1.0 for the math to work correctly. However, this is tricky with 64 independent knobs. **Open question — see below.**

---

## MIDI (hardcoded for now)

State `i` → MIDI channel `i + 1` (so state 0 = ch 1, state 7 = ch 8).

**Open questions about note per state — see below.**

Note duration and velocity are hardcoded for now (e.g., 100ms duration, velocity 100).

---

## UI: 8x8 Knob Grid

64 `react-knob-headless` instances arranged in an 8×8 grid.

- Each knob controls the transition probability for one cell (0.0 – 1.0)
- Knobs need to be compact — fitting 64 on screen is the layout challenge
- Each row gets a label on the left (State A–H or 1–8)
- Each column gets a label on top (target state)
- The currently-playing state row is visually highlighted
- A "row sum" indicator per row shows the current sum of that row's probabilities (to signal to the user whether the row is normalized)

---

## Other UI Controls

- **Start / Stop** button
- **BPM** input or knob
- **Step counter** (read-only display from server)
- **Current state indicator** (read-only, pushed from server)
- **State history** (scrolling log of recent states, optional)

---

## Server API (WebSocket messages)

### Client → Server

| Message | Payload | Effect |
|---|---|---|
| `set_cell` | `{ row, col, value }` | Update one probability |
| `set_bpm` | `{ bpm }` | Update BPM |
| `start` | — | Start sequencer |
| `stop` | — | Stop sequencer |

### Server → Client

| Message | Payload | When |
|---|---|---|
| `state_update` | `{ matrix, bpm, isRunning, currentState, stepCount }` | On connect + after any change |
| `step` | `{ fromState, toState, step, timestamp }` | Every sequencer tick |

---

## Sequencer Engine

Adapted from `src-OLD/sequencer/engine.ts`. Core logic is reusable:

- `selectNextState(currentState, matrix)` — cumulative probability selection
- `bpmToMs(bpm)` — 16th note timing: `(60 * 1000) / bpm / 4`
- Timer loop using `setTimeout` (same pattern as before)

The server normalizes each row before using it in `selectNextState`, so the client can send raw 0–1 values per knob without them needing to sum to exactly 1.0.

---

## Open Questions

### 1. Row normalization UX

With 64 independent knobs, rows won't automatically sum to 1.0. Go with option A:

**A) Server normalizes silently** — the server normalizes each row before stepping. Knobs always show the raw values you set, but the actual probabilities used are scaled. Simple but potentially surprising (a knob showing 0.5 might actually be 0.25 if the row sums to 2.0).

### 2. Note per state

For MIDI output, what note should each state play?

For now, just use the default note 36.

### 3. Knob interaction model

`react-knob-headless` is a headless component — you supply the visual rendering. What should the knob look like? Options:

- A small circular arc/dial
- A vertical slider
- A numeric text input with scroll-to-adjust

Given 64 of them on screen, small circular dials are probably most compact. I can implement a simple arc-style SVG renderer.

### 4. Initial matrix values

What should the matrix start with?

- Option A: All zeros (no transitions defined)
- Option B: Uniform (each cell = 1/8 = 0.125, equal probability everywhere)
- Option C: Identity (each state loops to itself, probability 1.0 on diagonal)

Start with Identity. All knobs on a diagonal are 1.0, the rest are 0.0.

### 5. Real-time state highlight

When the sequencer is running, should the currently-active state row flash/highlight? (Seems obviously yes — just confirming.)

Yes, this would be nice.

---

## What's NOT in scope yet

- MIDI device selection UI
- Per-state note/velocity/duration configuration UI
- Row operation algorithms (sharpen, flatten, rotate, leak) from old code
- Multiple sequencer instances
- N instances of a sequencing matrix for a 2nd, 3rd, or 4th voice. 