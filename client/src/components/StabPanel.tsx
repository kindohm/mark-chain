/**
 * StabPanel — UI for a Stab voice (Stab 1 or Stab 2)
 *
 * Normal mode: linear on/off step grid, division, note, device, channel
 * Mirror mode: can send note-on or very-low-velocity note messages on selected
 * Drum Markov states
 */
import { useEffect, useRef } from 'react';
import type { ChainState, ClientMessage, StabState } from '../types';
import HeadlessSlider from './HeadlessSlider';

const STATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const XY_SIZE = 220;
const XY_PAD = 12;
const STAB_CONTROL_CC_LABELS = [
    { x: 100, y: 101, slider1: 102, slider2: 106 },
    { x: 103, y: 104, slider1: 105, slider2: 107 },
] as const;

interface StabPanelProps {
    stab: StabState;
    chain: ChainState | null; // needed for mirror state select options
    onMessage: (msg: ClientMessage) => void;
}

const clampMidi = (value: number) => Math.max(0, Math.min(127, Math.round(value)));

export default function StabPanel({ stab, chain, onMessage }: StabPanelProps) {
    const { stabId } = stab;
    const controlCcs = STAB_CONTROL_CC_LABELS[stabId] ?? STAB_CONTROL_CC_LABELS[0];
    const surfaceRef = useRef<SVGSVGElement | null>(null);
    const draggingPointerIdRef = useRef<number | null>(null);
    const lastSentXYRef = useRef({ x: stab.x, y: stab.y });
    const lastSentCc3Ref = useRef(stab.cc3);
    const lastSentCc4Ref = useRef(stab.cc4);

    useEffect(() => {
        lastSentXYRef.current = { x: stab.x, y: stab.y };
    }, [stab.x, stab.y]);

    useEffect(() => {
        lastSentCc3Ref.current = stab.cc3;
    }, [stab.cc3]);

    useEffect(() => {
        lastSentCc4Ref.current = stab.cc4;
    }, [stab.cc4]);

    const send = (msg: ClientMessage) => onMessage(msg);

    const handleToggle = () =>
        send({ type: 'set_stab_enabled', stabId, isEnabled: !stab.isEnabled });

    const handleStep = (i: number) =>
        send({ type: 'set_stab_step', stabId, stepIndex: i, on: !stab.steps[i] });

    const handleNumSteps = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 32) send({ type: 'set_stab_num_steps', stabId, numSteps: n });
    };

    const handleDivision = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 16) send({ type: 'set_stab_division', stabId, division: n });
    };

    const handleNote = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 0 && n <= 127) send({ type: 'set_stab_note', stabId, midiNote: n });
    };

    const handleDevice = (e: React.ChangeEvent<HTMLSelectElement>) =>
        send({ type: 'set_stab_midi', stabId, midiDevice: e.target.value });

    const handleChannel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 16) send({ type: 'set_stab_midi', stabId, channel: n });
    };

    const handleMirrorToggle = () =>
        send({ type: 'set_stab_mirror', stabId, mirrorEnabled: !stab.mirrorEnabled, mirrorState: stab.mirrorState });

    const handleMirrorState = (e: React.ChangeEvent<HTMLSelectElement>) =>
        send({ type: 'set_stab_mirror', stabId, mirrorEnabled: stab.mirrorEnabled, mirrorState: Number(e.target.value) });

    const handleMirrorOffToggle = () =>
        send({ type: 'set_stab_mirror_off', stabId, mirrorOffEnabled: !stab.mirrorOffEnabled, mirrorOffState: stab.mirrorOffState });

    const handleMirrorOffState = (e: React.ChangeEvent<HTMLSelectElement>) =>
        send({ type: 'set_stab_mirror_off', stabId, mirrorOffEnabled: stab.mirrorOffEnabled, mirrorOffState: Number(e.target.value) });

    const sendXYIfChanged = (x: number, y: number) => {
        const next = { x: clampMidi(x), y: clampMidi(y) };
        const prev = lastSentXYRef.current;
        if (next.x === prev.x && next.y === prev.y) return;

        lastSentXYRef.current = next;
        send({
            type: 'set_stab_xy',
            stabId,
            ...(next.x !== prev.x ? { x: next.x } : {}),
            ...(next.y !== prev.y ? { y: next.y } : {}),
        });
    };

    const sendCc3IfChanged = (value: number) => {
        const next = clampMidi(value);
        if (next === lastSentCc3Ref.current) return;
        lastSentCc3Ref.current = next;
        send({ type: 'set_stab_cc3', stabId, value: next });
    };

    const sendCc4IfChanged = (value: number) => {
        const next = clampMidi(value);
        if (next === lastSentCc4Ref.current) return;
        lastSentCc4Ref.current = next;
        send({ type: 'set_stab_cc4', stabId, value: next });
    };

    const getXYFromPointer = (clientX: number, clientY: number) => {
        const svg = surfaceRef.current;
        if (!svg) return null;
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const px = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const py = Math.max(0, Math.min(rect.height, clientY - rect.top));
        const x = clampMidi((px / rect.width) * 127);
        const y = clampMidi((1 - py / rect.height) * 127);
        return { x, y };
    };

    const updateFromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
        const xy = getXYFromPointer(e.clientX, e.clientY);
        if (!xy) return;
        sendXYIfChanged(xy.x, xy.y);
    };

    const handleSurfacePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        draggingPointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromPointer(e);
    };

    const handleSurfacePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (draggingPointerIdRef.current !== e.pointerId) return;
        updateFromPointer(e);
    };

    const handleSurfacePointerEnd = (e: React.PointerEvent<SVGSVGElement>) => {
        if (draggingPointerIdRef.current !== e.pointerId) return;
        draggingPointerIdRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const handleSurfaceKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
        const step = e.shiftKey ? 8 : 1;
        let nextX = stab.x;
        let nextY = stab.y;

        if (e.key === 'ArrowLeft') nextX -= step;
        else if (e.key === 'ArrowRight') nextX += step;
        else if (e.key === 'ArrowDown') nextY -= step;
        else if (e.key === 'ArrowUp') nextY += step;
        else if (e.key === 'Home') { nextX = 0; nextY = 0; }
        else if (e.key === 'End') { nextX = 127; nextY = 127; }
        else return;

        e.preventDefault();
        sendXYIfChanged(nextX, nextY);
    };

    const numStates = chain?.numStates ?? 8;

    const knobX = (stab.x / 127) * XY_SIZE;
    const knobY = ((127 - stab.y) / 127) * XY_SIZE;
    const gridTicks = [0.25, 0.5, 0.75];

    return (
        <div className="stab-panel">

            {/* ── Top controls row ── */}
            <div className="stab-controls-row">
                <div className="anchor-field">
                    <label className="control-label">On / Off</label>
                    <button
                        className={`anchor-toggle ${stab.isEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                        onClick={handleToggle}
                    >
                        {stab.isEnabled ? '● On' : '○ Off'}
                    </button>
                </div>

                <div className="anchor-field">
                    <label className="control-label">Steps</label>
                    <input type="number" className="control-input" value={stab.numSteps} min={1} max={32} onChange={handleNumSteps} />
                </div>

                <div className="anchor-field">
                    <label className="control-label">Division</label>
                    <input type="number" className="control-input" value={stab.division} min={1} max={16} onChange={handleDivision} />
                </div>

                <div className="anchor-field">
                    <label className="control-label">Note</label>
                    <input type="number" className="control-input" value={stab.midiNote} min={0} max={127} onChange={handleNote} />
                </div>

                <div className="anchor-field anchor-field--device">
                    <label className="control-label">Device</label>
                    <select className="row-midi-select anchor-select" value={stab.midiDevice} onChange={handleDevice}>
                        {stab.midiDevices.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div className="anchor-field">
                    <label className="control-label">Channel</label>
                    <input type="number" className="control-input" value={stab.channel} min={1} max={16} onChange={handleChannel} />
                </div>
            </div>

            <div className="stab-xy-row">
                <div className="stab-xy-surface-wrap">
                    <div className="stab-xy-header">
                        <label className="control-label">X/Y CC Surface</label>
                        <div className="stab-xy-values">
                            <span>{`X(CC${controlCcs.x}): ${stab.x}`}</span>
                            <span>{`Y(CC${controlCcs.y}): ${stab.y}`}</span>
                        </div>
                    </div>
                    <svg
                        ref={surfaceRef}
                        className="stab-xy-surface"
                        viewBox={`0 0 ${XY_SIZE} ${XY_SIZE}`}
                        role="img"
                        aria-label={`X Y control surface, X ${stab.x}, Y ${stab.y}`}
                        tabIndex={0}
                        onPointerDown={handleSurfacePointerDown}
                        onPointerMove={handleSurfacePointerMove}
                        onPointerUp={handleSurfacePointerEnd}
                        onPointerCancel={handleSurfacePointerEnd}
                        onKeyDown={handleSurfaceKeyDown}
                    >
                        <rect x={0} y={0} width={XY_SIZE} height={XY_SIZE} rx={8} className="stab-xy-bg" />
                        <rect x={XY_PAD} y={XY_PAD} width={XY_SIZE - XY_PAD * 2} height={XY_SIZE - XY_PAD * 2} className="stab-xy-inner" />
                        {gridTicks.map((t) => (
                            <line
                                key={`v-${t}`}
                                x1={t * XY_SIZE}
                                y1={XY_PAD}
                                x2={t * XY_SIZE}
                                y2={XY_SIZE - XY_PAD}
                                className="stab-xy-grid"
                            />
                        ))}
                        {gridTicks.map((t) => (
                            <line
                                key={`h-${t}`}
                                x1={XY_PAD}
                                y1={t * XY_SIZE}
                                x2={XY_SIZE - XY_PAD}
                                y2={t * XY_SIZE}
                                className="stab-xy-grid"
                            />
                        ))}
                        <line x1={knobX} y1={XY_PAD} x2={knobX} y2={XY_SIZE - XY_PAD} className="stab-xy-cross" />
                        <line x1={XY_PAD} y1={knobY} x2={XY_SIZE - XY_PAD} y2={knobY} className="stab-xy-cross" />
                        <circle cx={knobX} cy={knobY} r={11} className="stab-xy-knob-outer" />
                        <circle cx={knobX} cy={knobY} r={5} className="stab-xy-knob-inner" />
                    </svg>
                </div>

                <div className="stab-cc3-wrap">
                    <div className="stab-xy-header">
                        <label className="control-label">ENV</label>
                        <div className="stab-xy-values">
                            <span>{`CC${controlCcs.slider1}: ${stab.cc3}`}</span>
                        </div>
                    </div>
                    <div className="stab-cc3-slider-wrap">
                        <HeadlessSlider
                            ariaLabel={`CC${controlCcs.slider1} slider, value ${stab.cc3}`}
                            className="stab-cc3-slider"
                            value={stab.cc3}
                            min={0}
                            max={127}
                            step={1}
                            onChange={sendCc3IfChanged}
                        />
                    </div>
                </div>

                <div className="stab-cc3-wrap">
                    <div className="stab-xy-header">
                        <label className="control-label">DECAY</label>
                        <div className="stab-xy-values">
                            <span>{`CC${controlCcs.slider2}: ${stab.cc4}`}</span>
                        </div>
                    </div>
                    <div className="stab-cc3-slider-wrap">
                        <HeadlessSlider
                            ariaLabel={`CC${controlCcs.slider2} slider, value ${stab.cc4}`}
                            className="stab-cc3-slider"
                            value={stab.cc4}
                            min={0}
                            max={127}
                            step={1}
                            onChange={sendCc4IfChanged}
                        />
                    </div>
                </div>
            </div>

            {/* ── Mirror row ── */}
            <div className="stab-mirror-row">
                <button
                    className={`anchor-toggle stab-mirror-btn ${stab.mirrorEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                    onClick={handleMirrorToggle}
                    title="When enabled, this stab sends a normal note when the Drums tab enters the selected state"
                >
                    {stab.mirrorEnabled ? '◈ Mirror On: On' : '◇ Mirror On: Off'}
                </button>

                <div className="anchor-field">
                    <label className="control-label">Mirror On State</label>
                    <select
                        className="row-midi-select"
                        value={stab.mirrorState}
                        onChange={handleMirrorState}
                    >
                        {STATE_LABELS.slice(0, numStates).map((label, i) => (
                            <option key={i} value={i}>{label}</option>
                        ))}
                    </select>
                </div>

                <button
                    className={`anchor-toggle stab-mirror-btn ${stab.mirrorOffEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                    onClick={handleMirrorOffToggle}
                    title="When enabled, this stab sends a very low velocity note (5) when the Drums tab enters the selected state"
                >
                    {stab.mirrorOffEnabled ? '◈ Mirror Off: On' : '◇ Mirror Off: Off'}
                </button>

                <div className="anchor-field">
                    <label className="control-label">Mirror Off State</label>
                    <select
                        className="row-midi-select"
                        value={stab.mirrorOffState}
                        onChange={handleMirrorOffState}
                    >
                        {STATE_LABELS.slice(0, numStates).map((label, i) => (
                            <option key={`off-${i}`} value={i}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Step grid ── */}
            {!stab.mirrorEnabled && (
                <div className="stab-step-grid">
                    {Array.from({ length: stab.numSteps }, (_, i) => {
                        const isOn = stab.steps[i];
                        const isActive = i === stab.currentStep; // always show playhead
                        const isCursor = isActive && !stab.isEnabled;
                        return (
                            <button
                                key={i}
                                className={[
                                    'stab-step',
                                    isOn ? 'stab-step--on' : '',
                                    isActive && stab.isEnabled ? 'stab-step--active' : '',
                                    isCursor ? 'stab-step--cursor' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={() => handleStep(i)}
                                title={`Step ${i + 1}`}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
