import { useState } from "react";
import { useSequencer } from "./hooks/useSequencer";
import KnobGrid from "./components/KnobGrid";
import Controls from "./components/Controls";
import AnchorPanel from "./components/AnchorPanel";
import StabPanel from "./components/StabPanel";
import LayerPanel from "./components/LayerPanel";
import MixerPanel from "./components/MixerPanel";
import OscPanel from "./components/OscPanel";
import Presets from "./components/Presets";
import type { ClientMessage } from "./types";

type Tab =
  | "drums"
  | "anchor"
  | "stab1"
  | "stab2"
  | "layer1"
  | "layer2"
  | "mixer"
  | "osc";

const rnd = (min: number, max: number) => min + Math.random() * (max - min);
const rndInt = (min: number, max: number) => Math.floor(rnd(min, max + 1));
const rndBool = (pTrue = 0.5) => Math.random() < pTrue;
// Velocity favors 1.0: 60% chance of max, otherwise random 0.3–1.0
const rndVel = () => (rndBool(0.6) ? 1.0 : rnd(0.3, 1.0));

export default function App() {
  const { chains, anchor, stabs, layers, mixer, osc, connected, sendMessage } =
    useSequencer();
  const [activeTab, setActiveTab] = useState<Tab>("drums");

  const chain = chains[0] ?? null;
  const stab0 = stabs.find((s) => s.stabId === 0) ?? null;
  const stab1 = stabs.find((s) => s.stabId === 1) ?? null;
  const layer0 = layers.find((l) => l.layerId === 0) ?? null;
  const layer1 = layers.find((l) => l.layerId === 1) ?? null;

  const handleMessage = (msg: ClientMessage) => sendMessage(msg);

  // ─── RANDOMIZE RULE ───────────────────────────────────────────────────────
  // When adding a new configurable parameter, add it here UNLESS it is:
  //   • a MIDI device name
  //   • a MIDI channel number
  //   • the master start/stop state
  // Everything else should be randomized when this button is clicked.
  // ──────────────────────────────────────────────────────────────────────────
  const handleRandomize = () => {
    if (!chain) return;
    const send = (msg: ClientMessage) => sendMessage(msg);

    // BPM (70–200)
    const bpm = rndInt(70, 200);
    send({ type: "set_bpm", chainId: chain.chainId, bpm });

    // Num states (2–8)
    const numStates = rndInt(2, 8);
    send({ type: "set_num_states", chainId: chain.chainId, numStates });

    // Matrix cells — random 0–1; server normalizes per row
    for (let row = 0; row < chain.matrix.length; row++) {
      for (let col = 0; col < chain.matrix[row].length; col++) {
        send({
          type: "set_cell",
          chainId: chain.chainId,
          row,
          col,
          value: Math.random(),
        });
      }
    }

    // Velocity min per state (favor 1.0)
    chain.velocityMin.forEach((_, i) => {
      send({
        type: "set_velocity_min",
        chainId: chain.chainId,
        stateIndex: i,
        value: rndVel(),
      });
    });

    // Anchor: non-MIDI params
    if (anchor) {
      send({ type: "set_anchor_enabled", isEnabled: rndBool() });
      send({ type: "set_anchor_division", division: rndInt(1, 16) });
    }

    // Stabs: non-MIDI params
    stabs.forEach((s) => {
      const numSteps = rndInt(4, 32);
      send({ type: "set_stab_num_steps", stabId: s.stabId, numSteps });
      send({
        type: "set_stab_division",
        stabId: s.stabId,
        division: rndInt(1, 8),
      });
      send({
        type: "set_stab_xy",
        stabId: s.stabId,
        x: rndInt(0, 127),
        y: rndInt(0, 127),
      });
      send({ type: "set_stab_cc3", stabId: s.stabId, value: rndInt(0, 127) });
      // Random step pattern (~35% density)
      for (let i = 0; i < numSteps; i++) {
        send({
          type: "set_stab_step",
          stabId: s.stabId,
          stepIndex: i,
          on: rndBool(0.35),
        });
      }
      // Clear any steps beyond new numSteps
      for (let i = numSteps; i < 32; i++) {
        send({
          type: "set_stab_step",
          stabId: s.stabId,
          stepIndex: i,
          on: false,
        });
      }
      // Mirror
      send({
        type: "set_stab_mirror",
        stabId: s.stabId,
        mirrorEnabled: rndBool(0.4),
        mirrorState: rndInt(0, numStates - 1),
      });
    });

    // Layers: non-MIDI params
    layers.forEach((l) => {
      send({
        type: "set_layer_enabled",
        layerId: l.layerId,
        isEnabled: rndBool(0.6),
      });
      send({
        type: "set_layer_division",
        layerId: l.layerId,
        division: rndInt(16, 256),
      });
      send({
        type: "set_layer_velocity",
        layerId: l.layerId,
        velocity: rnd(0.3, 1.0),
      });
      send({
        type: "set_layer_duration_pct",
        layerId: l.layerId,
        durationPct: rnd(0.1, 0.95),
      });
    });
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "drums", label: "Drums" },
    { id: "anchor", label: "Anchor" },
    { id: "stab1", label: "Stab 1" },
    { id: "stab2", label: "Stab 2" },
    { id: "layer1", label: "Layer 1" },
    { id: "layer2", label: "Layer 2" },
    { id: "mixer", label: "Mixer" },
    { id: "osc", label: "OSC" },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">mark-chain</h1>
        <div
          className={`connection-badge ${connected ? "connected" : "disconnected"}`}
        >
          {connected ? "● connected" : "○ connecting…"}
        </div>
      </header>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? "tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="app-body">
        <main className="app-main">
          {activeTab === "drums" && chain && (
            <KnobGrid chain={chain} onMessage={handleMessage} />
          )}
          {activeTab === "anchor" &&
            (anchor ? (
              <AnchorPanel anchor={anchor} onMessage={handleMessage} />
            ) : (
              <div className="loading">Loading anchor…</div>
            ))}
          {activeTab === "stab1" &&
            (stab0 ? (
              <StabPanel stab={stab0} chain={chain} onMessage={handleMessage} />
            ) : (
              <div className="loading">Loading stab 1…</div>
            ))}
          {activeTab === "stab2" &&
            (stab1 ? (
              <StabPanel stab={stab1} chain={chain} onMessage={handleMessage} />
            ) : (
              <div className="loading">Loading stab 2…</div>
            ))}
          {activeTab === "layer1" &&
            (layer0 ? (
              <LayerPanel layer={layer0} onMessage={handleMessage} />
            ) : (
              <div className="loading">Loading layer 1…</div>
            ))}
          {activeTab === "layer2" &&
            (layer1 ? (
              <LayerPanel layer={layer1} onMessage={handleMessage} />
            ) : (
              <div className="loading">Loading layer 2…</div>
            ))}
          {activeTab === "mixer" && (
            <MixerPanel mixer={mixer} onMessage={handleMessage} />
          )}
          {activeTab === "osc" &&
            (osc ? (
              <OscPanel osc={osc} onMessage={handleMessage} />
            ) : (
              <div className="loading">Loading OSC…</div>
            ))}
        </main>

        <aside className="app-right">
          {chain ? (
            <Controls chain={chain} onMessage={handleMessage} />
          ) : (
            <div className="loading">
              {connected ? "Loading…" : "Connecting…"}
            </div>
          )}
          <button
            className="btn-randomize"
            onClick={handleRandomize}
            disabled={!chain}
            title="Randomize all non-MIDI parameters"
          >
            ⚄ Randomize
          </button>
          <Presets
            chain={chain}
            anchor={anchor}
            stabs={stabs}
            layers={layers}
            sendMessage={sendMessage}
          />
        </aside>
      </div>
    </div>
  );
}
