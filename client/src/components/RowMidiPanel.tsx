import type { StateMidiConfig, ClientMessage } from '../types';

const STATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface RowMidiPanelProps {
    chainId: string;
    numStates: number;
    stateMidi: StateMidiConfig[];
    midiDevices: string[];
    onMessage: (msg: ClientMessage) => void;
}

export default function RowMidiPanel({
    chainId,
    numStates,
    stateMidi,
    midiDevices,
    onMessage,
}: RowMidiPanelProps) {
    const handleDevice = (stateIndex: number, deviceName: string) => {
        onMessage({ type: 'set_state_midi', chainId, stateIndex, deviceName });
    };

    const handleChannel = (stateIndex: number, channel: number) => {
        if (channel >= 1 && channel <= 16) {
            onMessage({ type: 'set_state_midi', chainId, stateIndex, channel });
        }
    };

    return (
        <div className="row-midi-panel">
            {/* Header row — spans same height as knob-grid-labels-row */}
            <div className="row-midi-header">MIDI</div>

            {Array.from({ length: numStates }, (_, i) => {
                const cfg = stateMidi[i] ?? { deviceName: '', channel: i + 1 };
                const isRest = i === numStates - 1;

                return (
                    <div key={i} className={`row-midi-row${isRest ? ' row-midi-row--rest' : ''}`}>
                        <div className="row-midi-state-label">{STATE_LABELS[i]}</div>
                        {isRest ? (
                            <div className="row-midi-rest-label">rest</div>
                        ) : (
                            <>
                                <select
                                    className="row-midi-select"
                                    value={cfg.deviceName}
                                    onChange={(e) => handleDevice(i, e.target.value)}
                                >
                                    {midiDevices.length === 0 && (
                                        <option value="">No devices</option>
                                    )}
                                    {midiDevices.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    className="row-midi-channel"
                                    value={cfg.channel}
                                    min={1}
                                    max={16}
                                    onChange={(e) => handleChannel(i, Number(e.target.value))}
                                />
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
