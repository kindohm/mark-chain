import type { AnchorState, ClientMessage } from '../types';

interface AnchorPanelProps {
    anchor: AnchorState;
    onMessage: (msg: ClientMessage) => void;
}

export default function AnchorPanel({ anchor, onMessage }: AnchorPanelProps) {
    const handleToggle = () => {
        onMessage({ type: 'set_anchor_enabled', isEnabled: !anchor.isEnabled });
    };

    const handleDivision = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 16) {
            onMessage({ type: 'set_anchor_division', division: n });
        }
    };

    const handleDevice = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onMessage({ type: 'set_anchor_midi', midiDevice: e.target.value });
    };

    const handleChannel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        if (n >= 1 && n <= 16) {
            onMessage({ type: 'set_anchor_midi', channel: n });
        }
    };

    return (
        <div className="anchor-panel">
            <div className="anchor-row">
                <div className="anchor-field">
                    <label className="control-label">On / Off</label>
                    <button
                        className={`anchor-toggle ${anchor.isEnabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                        onClick={handleToggle}
                    >
                        {anchor.isEnabled ? '● On' : '○ Off'}
                    </button>
                </div>

                <div className="anchor-field">
                    <label className="control-label">Division</label>
                    <input
                        type="number"
                        className="control-input"
                        value={anchor.division}
                        min={1}
                        max={16}
                        onChange={handleDivision}
                    />
                </div>

                <div className="anchor-field anchor-field--device">
                    <label className="control-label">Device</label>
                    <select
                        className="row-midi-select anchor-select"
                        value={anchor.midiDevice}
                        onChange={handleDevice}
                    >
                        {anchor.midiDevices.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                <div className="anchor-field">
                    <label className="control-label">Channel</label>
                    <input
                        type="number"
                        className="control-input"
                        value={anchor.channel}
                        min={1}
                        max={16}
                        onChange={handleChannel}
                    />
                </div>
            </div>

            <div className="anchor-step-info">
                Step {anchor.stepCount}
            </div>
        </div>
    );
}
