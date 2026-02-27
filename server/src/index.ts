/**
 * Server entry point — Express + WebSocket
 */

import { createServer } from "http";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { ChainManager } from "./chain/ChainManager.js";
import { AnchorInstance } from "./anchor/AnchorInstance.js";
import { StabInstance } from "./stab/StabInstance.js";
import { LayerInstance } from "./layer/LayerInstance.js";
import chainConfigs from "./config.js";
import type {
  ClientMessage,
  MixerCcLevels,
  ServerMessage,
} from "./protocol.js";
import { OscForwarder } from "./osc/OscForwarder.js";
import { TransportClock } from "./sequencer/TransportClock.js";

const PORT = 3000;
const MIXER_DEVICE = "IAC Driver Bus 5";
const MIXER_CHANNEL = 1;
const MIXER_DEFAULT = 0.8;
const UI_FLUSH_INTERVAL_MS = 33;
const WS_BACKPRESSURE_DROP_THRESHOLD_BYTES = 512 * 1024;
const METRICS_LOG_INTERVAL_MS = 10_000;
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

type BroadcastOptions = {
  critical?: boolean;
};

type PerfCounters = {
  tickLagMs: number[];
  tickDurationMs: number[];
  tickCount: number;
  tickOverruns: number;
  serializationCount: number;
  serializationMsTotal: number;
  wsMessagesSent: number;
  wsBytesSent: number;
  wsMessagesDropped: number;
};

const perf: PerfCounters = {
  tickLagMs: [],
  tickDurationMs: [],
  tickCount: 0,
  tickOverruns: 0,
  serializationCount: 0,
  serializationMsTotal: 0,
  wsMessagesSent: 0,
  wsBytesSent: 0,
  wsMessagesDropped: 0,
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * (sorted.length - 1)),
  );
  return sorted[idx];
}

function reportAndResetPerfCounters(): void {
  if (
    perf.tickCount === 0 &&
    perf.serializationCount === 0 &&
    perf.wsMessagesSent === 0 &&
    perf.wsMessagesDropped === 0
  ) {
    return;
  }
  const lagP50 = percentile(perf.tickLagMs, 50);
  const lagP95 = percentile(perf.tickLagMs, 95);
  const lagMax = perf.tickLagMs.length > 0 ? Math.max(...perf.tickLagMs) : 0;
  const durP50 = percentile(perf.tickDurationMs, 50);
  const durP95 = percentile(perf.tickDurationMs, 95);
  const durMax =
    perf.tickDurationMs.length > 0 ? Math.max(...perf.tickDurationMs) : 0;
  const serializeAvg =
    perf.serializationCount > 0
      ? perf.serializationMsTotal / perf.serializationCount
      : 0;
  console.log(
    `[perf] ticks=${perf.tickCount} overruns=${perf.tickOverruns} ` +
      `lag(ms) p50=${lagP50.toFixed(2)} p95=${lagP95.toFixed(2)} max=${lagMax.toFixed(2)} ` +
      `tickWork(ms) p50=${durP50.toFixed(2)} p95=${durP95.toFixed(2)} max=${durMax.toFixed(2)} ` +
      `serialize(ms) avg=${serializeAvg.toFixed(3)} count=${perf.serializationCount} ` +
      `ws sent=${perf.wsMessagesSent} bytes=${perf.wsBytesSent} dropped=${perf.wsMessagesDropped}`,
  );

  perf.tickLagMs = [];
  perf.tickDurationMs = [];
  perf.tickCount = 0;
  perf.tickOverruns = 0;
  perf.serializationCount = 0;
  perf.serializationMsTotal = 0;
  perf.wsMessagesSent = 0;
  perf.wsBytesSent = 0;
  perf.wsMessagesDropped = 0;
}

function broadcast(msg: ServerMessage, opts: BroadcastOptions = {}): void {
  const critical = opts.critical ?? true;
  const serializeStart = performance.now();
  const payload = JSON.stringify(msg);
  const serializeDurationMs = performance.now() - serializeStart;
  perf.serializationCount++;
  perf.serializationMsTotal += serializeDurationMs;
  const payloadBytes = Buffer.byteLength(payload);

  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    if (
      !critical &&
      client.bufferedAmount > WS_BACKPRESSURE_DROP_THRESHOLD_BYTES
    ) {
      perf.wsMessagesDropped++;
      continue;
    }
    client.send(payload);
    perf.wsMessagesSent++;
    perf.wsBytesSent += payloadBytes;
  }
}

type UiDirtyState = {
  anchor: boolean;
  stabs: Set<number>;
};

const uiDirty: UiDirtyState = {
  anchor: false,
  stabs: new Set(),
};

function markAnchorUiDirty(): void {
  uiDirty.anchor = true;
}

function markStabUiDirty(stabId: number): void {
  uiDirty.stabs.add(stabId);
}

const mixerCcLevels: MixerCcLevels = {
  drums: MIXER_DEFAULT,
  anchor: MIXER_DEFAULT,
  stab1: MIXER_DEFAULT,
  stab2: MIXER_DEFAULT,
  layer1: MIXER_DEFAULT,
  layer2: MIXER_DEFAULT,
};

const mixerUpdateMessage = (): ServerMessage => ({
  type: "mixer_update",
  levels: { ...mixerCcLevels },
});

// ─── OSC forwarding ──────────────────────────────────────────────────────────

let oscForwarder!: OscForwarder;

const oscConfigUpdateMessage = (): ServerMessage => ({
  type: "osc_config_update",
  config: oscForwarder.getConfig(),
  midiDevices: registry.getAvailableDevices(),
});

const oscDebugSnapshotMessage = (): ServerMessage => ({
  type: "osc_debug_snapshot",
  events: oscForwarder.getDebugLog(),
});

// ─── Chain manager ───────────────────────────────────────────────────────────

const chainManager = new ChainManager(chainConfigs);
const registry = chainManager.getRegistry();
const chains = chainManager.getAllChains();

oscForwarder = new OscForwarder({
  onDebugEvent: (event) => broadcast({ type: "osc_debug_event", event }),
  getAvailableMidiDevices: () => registry.getAvailableDevices(),
});
oscForwarder.hydrateDefaults();

// ─── Anchor ──────────────────────────────────────────────────────────────────

const anchor = new AnchorInstance(120, registry);

// ─── Stabs ───────────────────────────────────────────────────────────────────

const stab0 = new StabInstance(0, 120, registry);
const stab1 = new StabInstance(1, 120, registry);

stab0.setMidi({ midiDevice: "IAC Driver Bus 1" });
stab1.setMidi({ midiDevice: "IAC Driver Bus 2" });
stab0.setMirror(false, 0);
stab1.setMirror(false, 1);
stab0.setMirrorOff(false, 1);
stab1.setMirrorOff(false, 0);

stab0.onStepEvent(() => markStabUiDirty(stab0.id));
stab1.onStepEvent(() => markStabUiDirty(stab1.id));
stab0.onNoteFiredEvent((stabId) => {
  void oscForwarder.forwardStab(stabId);
});
stab1.onNoteFiredEvent((stabId) => {
  void oscForwarder.forwardStab(stabId);
});

const stabs = [stab0, stab1];

// Mirror mode: when the Markov chain transitions, notify all stabs
for (const chain of chains) {
  chain.onStepEvent((msg) => broadcast(msg, { critical: false }));
  chain.onTransitionEvent((toState) => {
    for (const stab of stabs) stab.onDrumStep(toState);
  });
  chain.onMidiNoteSentEvent((event) => {
    if (event.chainId !== "chain-0") return;
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
  onTickMetrics: (metrics) => {
    perf.tickCount++;
    perf.tickLagMs.push(metrics.lagMs);
    perf.tickDurationMs.push(metrics.tickDurationMs);
    if (metrics.overrun) perf.tickOverruns++;
  },
});

setInterval(() => {
  if (!uiDirty.anchor && uiDirty.stabs.size === 0) {
    return;
  }

  if (uiDirty.anchor) {
    broadcast(anchor.toUpdateMessage(), { critical: false });
    uiDirty.anchor = false;
  }

  for (const stabId of uiDirty.stabs) {
    const stab = stabs[stabId];
    if (stab) broadcast(stab.toUpdateMessage(), { critical: false });
  }
  uiDirty.stabs.clear();
}, UI_FLUSH_INTERVAL_MS);

setInterval(() => {
  reportAndResetPerfCounters();
}, METRICS_LOG_INTERVAL_MS);

// ─── WebSocket connection handler ─────────────────────────────────────────────

wss.on("connection", (ws) => {
  console.log("Client connected");

  for (const msg of chainManager.getAllStateUpdates())
    ws.send(JSON.stringify(msg));
  ws.send(JSON.stringify(anchor.toUpdateMessage()));
  for (const s of stabs) ws.send(JSON.stringify(s.toUpdateMessage()));
  for (const l of layers) ws.send(JSON.stringify(l.toUpdateMessage()));
  ws.send(JSON.stringify(mixerUpdateMessage()));
  ws.send(JSON.stringify(oscConfigUpdateMessage()));
  ws.send(JSON.stringify(oscDebugSnapshotMessage()));

  ws.on("message", (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString()) as ClientMessage;
    } catch {
      console.warn("Invalid message received:", data.toString());
      return;
    }

    // ── Anchor ────────────────────────────────────────────────────────────
    if (msg.type === "set_anchor_enabled") {
      anchor.setEnabled(msg.isEnabled);
      broadcast(anchor.toUpdateMessage());
      return;
    }
    if (msg.type === "set_anchor_division") {
      anchor.setDivision(msg.division);
      broadcast(anchor.toUpdateMessage());
      return;
    }
    if (msg.type === "set_anchor_midi") {
      anchor.setMidi({ midiDevice: msg.midiDevice, channel: msg.channel });
      broadcast(anchor.toUpdateMessage());
      return;
    }

    // ── Stabs ─────────────────────────────────────────────────────────────
    if (msg.type === "set_stab_enabled") {
      stabs[msg.stabId]?.setEnabled(msg.isEnabled);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_step") {
      stabs[msg.stabId]?.setStep(msg.stepIndex, msg.on);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_num_steps") {
      stabs[msg.stabId]?.setNumSteps(msg.numSteps);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_division") {
      stabs[msg.stabId]?.setDivision(msg.division);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_midi") {
      stabs[msg.stabId]?.setMidi({
        midiDevice: msg.midiDevice,
        channel: msg.channel,
      });
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_note") {
      stabs[msg.stabId]?.setNote(msg.midiNote);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_mirror") {
      stabs[msg.stabId]?.setMirror(msg.mirrorEnabled, msg.mirrorState);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_mirror_off") {
      stabs[msg.stabId]?.setMirrorOff(msg.mirrorOffEnabled, msg.mirrorOffState);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_xy") {
      stabs[msg.stabId]?.setXY({ x: msg.x, y: msg.y });
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_cc3") {
      stabs[msg.stabId]?.setCC3(msg.value);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_stab_cc4") {
      stabs[msg.stabId]?.setCC4(msg.value);
      broadcast(stabs[msg.stabId]!.toUpdateMessage());
      return;
    }

    // ── Layers ────────────────────────────────────────────────────────────
    if (msg.type === "set_layer_enabled") {
      layers[msg.layerId]?.setEnabled(msg.isEnabled);
      broadcast(layers[msg.layerId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_layer_division") {
      layers[msg.layerId]?.setDivision(msg.division);
      broadcast(layers[msg.layerId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_layer_midi") {
      layers[msg.layerId]?.setMidi({
        midiDevice: msg.midiDevice,
        channel: msg.channel,
      });
      broadcast(layers[msg.layerId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_layer_velocity") {
      layers[msg.layerId]?.setVelocity(msg.velocity);
      broadcast(layers[msg.layerId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_layer_duration_pct") {
      layers[msg.layerId]?.setDurationPct(msg.durationPct);
      broadcast(layers[msg.layerId]!.toUpdateMessage());
      return;
    }
    if (msg.type === "set_mixer_cc_level") {
      const value = Math.max(0, Math.min(1, msg.value));
      mixerCcLevels[msg.target] = value;
      registry.sendControlChange(
        MIXER_DEVICE,
        MIXER_CHANNEL,
        MIXER_CC_MAP[msg.target],
        Math.round(value * 127),
      );
      broadcast(mixerUpdateMessage());
      return;
    }
    if (msg.type === "set_osc_config") {
      oscForwarder.setConfig(msg.config);
      broadcast(oscConfigUpdateMessage());
      return;
    }

    // ── Chain messages (require chainId) ──────────────────────────────────
    const chain = chainManager.getChain(
      (msg as { chainId?: string }).chainId ?? "",
    );
    if (!chain) {
      console.warn("Unknown or missing chainId");
      return;
    }

    switch (msg.type) {
      case "set_cell":
        chain.setCell(msg.row, msg.col, msg.value);
        broadcast(chain.toStateUpdateMessage());
        break;
      case "shift_matrix":
        chain.shiftMatrix(msg.algorithm);
        broadcast(chain.toStateUpdateMessage());
        break;
      case "apply_matrix_transform":
        chain.applyMatrixTransform(
          msg.algorithm,
          msg.polarity,
          msg.amount,
          msg.cycleLength,
        );
        broadcast(chain.toStateUpdateMessage());
        break;
      case "set_bpm":
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
      case "set_num_states":
        chain.setNumStates(msg.numStates);
        broadcast(chain.toStateUpdateMessage());
        break;
      case "set_chain_enabled":
        chain.setEnabled(msg.isEnabled);
        broadcast(chain.toStateUpdateMessage());
        break;
      case "set_state_midi":
        chain.setStateMidi(msg.stateIndex, {
          ...(msg.deviceName !== undefined && { deviceName: msg.deviceName }),
          ...(msg.channel !== undefined && { channel: msg.channel }),
        });
        broadcast(chain.toStateUpdateMessage());
        break;
      case "set_velocity_min":
        chain.setVelocityMin(msg.stateIndex, msg.value);
        broadcast(chain.toStateUpdateMessage());
        break;
      case "start":
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
      case "stop":
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

  ws.on("close", () => console.log("Client disconnected"));
});

// ─── HTTP health check ────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", chains: chainManager.getAllChains().length });
});

// ─── Start ────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`brunchh server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});
