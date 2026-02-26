/**
 * StabPanel — UI for a Stab voice (Stab 1 or Stab 2)
 *
 * Normal mode: linear on/off step grid, division, note, device, channel
 * Mirror mode: fires whenever the Drum Markov chain enters the selected state
 */
import type { ChainState, ClientMessage, StabState } from '../types';

const STATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface StabPanelProps {
    stab: StabState;
    chain: ChainState | null; // needed for mirror state select options
    onMessage: (msg: ClientMessage) => void;
}

export default function StabPanel({ stab, chain, onMessage }: StabPanelProps) {
    const { stabId } = stab;

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

    const numStates = chain?.numStates ?? 8;

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

            {/* ── Mirror row ── */}
            <div className="stab-mirror-row">
                <button
                    className={`anchor-toggle stab-mirror-btn ${stab.mirrorEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                    onClick={handleMirrorToggle}
                    title="When enabled, this stab fires whenever the Drums tab enters the selected state"
                >
                    {stab.mirrorEnabled ? '◈ Mirror On' : '◇ Mirror Off'}
                </button>

                <div className="anchor-field">
                    <label className="control-label">Mirror State</label>
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
