import type { ClientMessage, OscState } from '../types';

interface OscPanelProps {
    osc: OscState;
    onMessage: (msg: ClientMessage) => void;
}

function formatTime(ts: number): string {
    try {
        return new Date(ts).toLocaleTimeString();
    } catch {
        return String(ts);
    }
}

export default function OscPanel({ osc, onMessage }: OscPanelProps) {
    const { config, midiDevices, debugLog } = osc;
    const deviceOptions = midiDevices.includes(config.drumMidiDevice) || !config.drumMidiDevice
        ? midiDevices
        : [config.drumMidiDevice, ...midiDevices];

    const sendConfig = (next: Partial<typeof config>) => {
        onMessage({ type: 'set_osc_config', config: next });
    };

    return (
        <div className="osc-panel">
            <div className="osc-config-grid">
                <label className="control-group">
                    <span className="control-label">Enabled</span>
                    <button
                        type="button"
                        className={`anchor-toggle ${config.enabled ? 'anchor-toggle--on' : 'anchor-toggle--off'}`}
                        onClick={() => sendConfig({ enabled: !config.enabled })}
                    >
                        {config.enabled ? '● On' : '○ Off'}
                    </button>
                </label>

                <label className="control-group">
                    <span className="control-label">Root Address</span>
                    <input
                        className="control-input"
                        type="text"
                        value={config.rootAddress}
                        onChange={(e) => sendConfig({ rootAddress: e.target.value })}
                        placeholder="/mark"
                    />
                </label>

                <label className="control-group">
                    <span className="control-label">Destination IP</span>
                    <input
                        className="control-input"
                        type="text"
                        value={config.host}
                        onChange={(e) => sendConfig({ host: e.target.value })}
                        placeholder="127.0.0.1"
                    />
                </label>

                <label className="control-group">
                    <span className="control-label">Destination Port</span>
                    <input
                        className="control-input"
                        type="number"
                        min={1}
                        max={65535}
                        value={config.port}
                        onChange={(e) => sendConfig({ port: Number(e.target.value) || 0 })}
                    />
                </label>

                <label className="control-group">
                    <span className="control-label">Drums MIDI Device</span>
                    <select
                        className="row-midi-select anchor-select"
                        value={config.drumMidiDevice}
                        onChange={(e) => sendConfig({ drumMidiDevice: e.target.value })}
                    >
                        <option value="">(none)</option>
                        {deviceOptions.map((name) => (
                            <option key={name} value={name}>
                                {name}{(!midiDevices.includes(name) ? ' (unavailable)' : '')}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="osc-mapping-note">
                Drums (`chain-0`) map selected device channels to `/kick1`, `/kick2`, `/snare1`, `/snare2`, `/perc1..4`; stabs send `/stab1` and `/stab2`. All messages send integer `1`.
            </div>

            <div className="osc-debug">
                <div className="osc-debug__header">
                    <div className="osc-debug__title">OSC Output</div>
                    <div className="osc-debug__count">{debugLog.length} events</div>
                </div>
                <div className="osc-debug__list" role="log" aria-live="polite">
                    {debugLog.length === 0 && (
                        <div className="osc-debug__empty">No OSC events yet.</div>
                    )}
                    {[...debugLog].reverse().map((event) => (
                        <div key={event.id} className={`osc-debug__row osc-debug__row--${event.status}`}>
                            <span className="osc-debug__time">{formatTime(event.timestamp)}</span>
                            <span className="osc-debug__status">{event.status}</span>
                            <span className="osc-debug__source">{event.source}</span>
                            <code className="osc-debug__address">{event.address}</code>
                            <span className="osc-debug__args">[{event.args.join(', ')}]</span>
                            {typeof event.channel === 'number' && (
                                <span className="osc-debug__meta">ch {event.channel}</span>
                            )}
                            {event.reason && (
                                <span className="osc-debug__reason">{event.reason}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
