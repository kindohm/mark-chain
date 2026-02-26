/**
 * Presets — Max/MSP-style 16-slot preset grid
 *
 * Long-press (≥600ms) → save current state to slot (with glow feedback)
 * Short-press → recall slot's state (sends set_* messages to server)
 * Empty slot short-press → no-op
 *
 * State persisted in browser localStorage, key: mark-chain-preset-{0..15}
 */
import { useEffect, useRef, useState } from 'react';
import type { AnchorState, ChainState, ClientMessage, LayerState, StabState, StateMidiConfig } from '../types';

const STORAGE_KEY = (i: number) => `mark-chain-preset-${i}`;
const LONG_PRESS_MS = 600;
const GLOW_MS = 1200;
const NUM_SLOTS = 30;

interface PresetData {
    bpm: number;
    chain: {
        matrix: number[][];
        numStates: number;
        stateMidi: StateMidiConfig[];
        velocityMin: number[];
    };
    anchor: { isEnabled: boolean; division: number; midiDevice: string; channel: number };
    stabs: StabState[];
    layers: LayerState[];
}

interface PresetsProps {
    chain: ChainState | null;
    anchor: AnchorState | null;
    stabs: StabState[];
    layers: LayerState[];
    sendMessage: (msg: ClientMessage) => void;
}

function loadPreset(i: number): PresetData | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY(i));
        return raw ? (JSON.parse(raw) as PresetData) : null;
    } catch { return null; }
}

function savePreset(i: number, data: PresetData) {
    localStorage.setItem(STORAGE_KEY(i), JSON.stringify(data));
}

export default function Presets({ chain, anchor, stabs, layers, sendMessage }: PresetsProps) {
    const [presets, setPresets] = useState<(PresetData | null)[]>(() =>
        Array.from({ length: NUM_SLOTS }, (_, i) => loadPreset(i))
    );
    const [glowingSlot, setGlowingSlot] = useState<number | null>(null);

    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refresh slot data from localStorage when component mounts
    useEffect(() => {
        setPresets(Array.from({ length: NUM_SLOTS }, (_, i) => loadPreset(i)));
    }, []);

    const captureState = (): PresetData | null => {
        if (!chain || !anchor) return null;
        return {
            bpm: chain.bpm,
            chain: {
                matrix: chain.matrix.map(row => [...row]),
                numStates: chain.numStates,
                stateMidi: chain.stateMidi.map(m => ({ ...m })),
                velocityMin: [...chain.velocityMin],
            },
            anchor: { isEnabled: anchor.isEnabled, division: anchor.division, midiDevice: anchor.midiDevice, channel: anchor.channel },
            stabs: stabs.map(s => ({ ...s, steps: [...s.steps] })),
            layers: layers.map(l => ({ ...l })),
        };
    };

    const recallPreset = (data: PresetData) => {
        // BPM (chainId from chain prop)
        if (!chain) return;
        sendMessage({ type: 'set_bpm', chainId: chain.chainId, bpm: data.bpm });

        // Chain
        sendMessage({ type: 'set_num_states', chainId: chain.chainId, numStates: data.chain.numStates });
        for (let row = 0; row < data.chain.matrix.length; row++) {
            for (let col = 0; col < data.chain.matrix[row].length; col++) {
                sendMessage({ type: 'set_cell', chainId: chain.chainId, row, col, value: data.chain.matrix[row][col] });
            }
        }
        data.chain.stateMidi.forEach((m, i) => {
            sendMessage({ type: 'set_state_midi', chainId: chain.chainId, stateIndex: i, deviceName: m.deviceName, channel: m.channel });
        });
        data.chain.velocityMin.forEach((v, i) => {
            sendMessage({ type: 'set_velocity_min', chainId: chain.chainId, stateIndex: i, value: v });
        });

        // Anchor
        sendMessage({ type: 'set_anchor_enabled', isEnabled: data.anchor.isEnabled });
        sendMessage({ type: 'set_anchor_division', division: data.anchor.division });
        sendMessage({ type: 'set_anchor_midi', midiDevice: data.anchor.midiDevice, channel: data.anchor.channel });

        // Stabs
        data.stabs.forEach(s => {
            const id = s.stabId;
            sendMessage({ type: 'set_stab_enabled', stabId: id, isEnabled: s.isEnabled });
            sendMessage({ type: 'set_stab_num_steps', stabId: id, numSteps: s.numSteps });
            sendMessage({ type: 'set_stab_division', stabId: id, division: s.division });
            sendMessage({ type: 'set_stab_midi', stabId: id, midiDevice: s.midiDevice, channel: s.channel });
            sendMessage({ type: 'set_stab_note', stabId: id, midiNote: s.midiNote });
            sendMessage({ type: 'set_stab_mirror', stabId: id, mirrorEnabled: s.mirrorEnabled, mirrorState: s.mirrorState });
            if (typeof s.x === 'number' || typeof s.y === 'number') {
                sendMessage({
                    type: 'set_stab_xy',
                    stabId: id,
                    ...(typeof s.x === 'number' ? { x: s.x } : {}),
                    ...(typeof s.y === 'number' ? { y: s.y } : {}),
                });
            }
            s.steps.forEach((on, stepIndex) => {
                sendMessage({ type: 'set_stab_step', stabId: id, stepIndex, on });
            });
        });

        // Layers
        data.layers.forEach(l => {
            const id = l.layerId;
            sendMessage({ type: 'set_layer_enabled', layerId: id, isEnabled: l.isEnabled });
            sendMessage({ type: 'set_layer_division', layerId: id, division: l.division });
            sendMessage({ type: 'set_layer_midi', layerId: id, midiDevice: l.midiDevice, channel: l.channel });
            sendMessage({ type: 'set_layer_velocity', layerId: id, velocity: l.velocity });
            sendMessage({ type: 'set_layer_duration_pct', layerId: id, durationPct: l.durationPct });
        });
    };

    const handlePointerDown = (i: number) => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => {
            pressTimer.current = null;
            // Long press → save
            const data = captureState();
            if (!data) return;
            savePreset(i, data);
            setPresets(prev => { const next = [...prev]; next[i] = data; return next; });
            // Glow feedback
            setGlowingSlot(i);
            if (glowTimer.current) clearTimeout(glowTimer.current);
            glowTimer.current = setTimeout(() => setGlowingSlot(null), GLOW_MS);
        }, LONG_PRESS_MS);
    };

    const handlePointerUp = (i: number) => {
        if (pressTimer.current) {
            // Short press — recall
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
            const data = presets[i];
            if (data) recallPreset(data);
        }
    };

    const handlePointerLeave = () => {
        if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    };

    return (
        <div className="presets">
            <div className="presets-label">PRESETS</div>
            <div className="presets-grid">
                {Array.from({ length: NUM_SLOTS }, (_, i) => {
                    const filled = presets[i] !== null;
                    const glowing = glowingSlot === i;
                    return (
                        <button
                            key={i}
                            className={[
                                'preset-btn',
                                filled ? 'preset-btn--filled' : '',
                                glowing ? 'preset-btn--glow' : '',
                            ].filter(Boolean).join(' ')}
                            onPointerDown={() => handlePointerDown(i)}
                            onPointerUp={() => handlePointerUp(i)}
                            onPointerLeave={handlePointerLeave}
                            title={filled ? `Slot ${i + 1}: long-press to overwrite` : `Slot ${i + 1}: long-press to save`}
                            aria-label={`Preset slot ${i + 1}`}
                        >
                            <span className="preset-btn-num">{i + 1}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
