import React, { useState } from 'react';
import ArcDial from './ArcDial';
import type { ClientMessage, ChainState } from '../types';

const STATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface KnobGridProps {
    chain: ChainState;
    onMessage: (msg: ClientMessage) => void;
}

export default function KnobGrid({ chain, onMessage }: KnobGridProps) {
    const [midiExpanded, setMidiExpanded] = useState(false);

    const { numStates } = chain;

    const handleChange = (row: number, col: number, value: number) =>
        onMessage({ type: 'set_cell', chainId: chain.chainId, row, col, value });

    const handleDevice = (stateIndex: number, deviceName: string) =>
        onMessage({ type: 'set_state_midi', chainId: chain.chainId, stateIndex, deviceName });

    const handleChannel = (stateIndex: number, channel: number) => {
        if (channel >= 1 && channel <= 16)
            onMessage({ type: 'set_state_midi', chainId: chain.chainId, stateIndex, channel });
    };

    const handleVelocityMin = (stateIndex: number, value: number) =>
        onMessage({ type: 'set_velocity_min', chainId: chain.chainId, stateIndex, value });

    /**
     * Collapsed:  [M/row-label 28px] [knob cols 52px × N]
     * Expanded:   [M 28px] [Device auto] [Ch 44px] [side+row-label 28px] [knob cols 52px × N]
     *
     * The first column is shared by the M button (header) and the row label (data rows)
     * when collapsed. When expanded the M button gets its own col and side-labels appear.
     */
    // Velocity column is always present (one extra 52px column at the right)
    const gridTemplateColumns = midiExpanded
        ? `28px minmax(120px, 200px) 44px 28px repeat(${numStates}, 52px) 52px`
        : `28px repeat(${numStates}, 52px) 52px`;

    return (
        <div className="knob-grid-container" style={{ gridTemplateColumns }}>

            {/* ── HEADER ROW ── */}
            <button
                className={`midi-toggle-btn${midiExpanded ? ' midi-toggle-btn--active' : ''}`}
                onClick={() => setMidiExpanded(v => !v)}
                title={midiExpanded ? 'Hide MIDI routing' : 'Show MIDI routing'}
            >
                {midiExpanded ? '◀' : 'M'}
            </button>
            {midiExpanded && <div className="midi-col-header">Device</div>}
            {midiExpanded && <div className="midi-col-header midi-col-header--ch">Ch</div>}
            {midiExpanded && <div />}  {/* spacer for row-label col */}
            {STATE_LABELS.slice(0, numStates).map(label => (
                <div key={label} className="knob-col-label">{label}</div>
            ))}
            {/* Velocity column header */}
            <div className="knob-col-label" style={{ color: 'var(--vel)' }}>VEL</div>

            {/* ── DATA ROWS ── */}
            {Array.from({ length: numStates }, (_, row) => {
                const isActive = chain.currentState === row && chain.isRunning;
                const cfg = chain.stateMidi?.[row];
                const cellBg = isActive ? 'var(--active-row-bg)' : undefined;

                return (
                    <React.Fragment key={row}>
                        {/* Col 1 (shared): side-label when expanded, row-label when collapsed */}
                        {midiExpanded ? (
                            <div className="knob-grid-side-label" style={{ background: cellBg }}>
                                {STATE_LABELS[row]}
                            </div>
                        ) : (
                            <div
                                className="knob-row-label"
                                style={{ background: cellBg, borderRadius: '5px 0 0 5px' }}
                            >
                                {STATE_LABELS[row]}
                            </div>
                        )}

                        {/* MIDI cols (expanded only) — all rows identical, 'rest' is a device option */}
                        {midiExpanded && (
                            <select
                                className="row-midi-select"
                                value={cfg?.deviceName ?? ''}
                                onChange={e => handleDevice(row, e.target.value)}
                            >
                                {(chain.midiDevices ?? []).map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        )}
                        {midiExpanded && (
                            <input
                                type="number"
                                className="row-midi-channel"
                                value={cfg?.channel ?? row + 1}
                                min={1}
                                max={16}
                                onChange={e => handleChannel(row, Number(e.target.value))}
                            />
                        )}

                        {/* Row label (knob grid side) — only rendered when expanded */}
                        {midiExpanded && (
                            <div
                                className="knob-row-label"
                                style={{ background: cellBg, borderRadius: '5px 0 0 5px' }}
                            >
                                {STATE_LABELS[row]}
                            </div>
                        )}

                        {/* Matrix knob cells */}
                        {Array.from({ length: numStates }, (_, col) => {
                            const value = chain.matrix[row]?.[col] ?? 0;
                            return (
                                <div
                                    key={col}
                                    className="knob-cell"
                                    style={{ background: cellBg }}
                                >
                                    <ArcDial value={value} size={48} onChange={v => handleChange(row, col, v)} />
                                    <div className="knob-value">{value.toFixed(2)}</div>
                                </div>
                            );
                        })}

                        {/* Velocity min knob */}
                        <div className="knob-cell vel-cell" style={{ background: cellBg, borderRadius: '0 5px 5px 0' }}>
                            <ArcDial
                                value={chain.velocityMin?.[row] ?? 1}
                                size={48}
                                onChange={v => handleVelocityMin(row, v)}
                            />
                            <div className="knob-value">{(chain.velocityMin?.[row] ?? 1).toFixed(2)}</div>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
